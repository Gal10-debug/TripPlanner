using server.Infrastructure;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Services;

public sealed class PasswordResetQueue(
    TripPlannerContext context, UserManager<IdentityUser> users,
    IDataProtectionProvider protection, IPasswordResetEmailSender sender,
    TimeProvider clock, ILogger<PasswordResetQueue> logger)
{
    private readonly IDataProtector protector = protection.CreateProtector("TripPlanner.PasswordResetQueue.v1");
    private const int MaxAttempts = 5;
    private sealed record Payload(string Email, string? UserId, string? SecurityStamp, string? Token);

    // Return the development token only when a new request was accepted. The response in production
    // is identical for missing accounts, suppressed requests and successfully queued requests.
    public async Task<string?> EnqueueAsync(string email, CancellationToken cancellationToken = default)
    {
        email = email.Trim();
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(users.NormalizeEmail(email))));
        var now = clock.GetUtcNow();
        var cutoff = now.AddMinutes(-5).UtcTicks;
        var user = await users.FindByEmailAsync(email);
        var token = user is null ? null : await users.GeneratePasswordResetTokenAsync(user);
        var payload = protector.Protect(JsonSerializer.Serialize(new Payload(email, user?.Id, user?.SecurityStamp, token)));
        // A single atomic upsert makes cooldown and deduplication survive restarts and concurrent requests.
        // Unknown addresses also get a cooldown record, without exposing which addresses are registered.
        var accepted = await context.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO PasswordResetDeliveries
                (EmailKey, ProtectedPayload, Status, RequestedUtcTicks, ExpiresUtcTicks, NextAttemptUtcTicks, Attempts, LeaseId)
            VALUES ({key}, {payload}, 'pending', {now.UtcTicks}, {now.AddHours(1).UtcTicks}, {now.UtcTicks}, 0, '')
            ON CONFLICT(EmailKey) DO UPDATE SET
                ProtectedPayload = excluded.ProtectedPayload, Status = 'pending',
                RequestedUtcTicks = excluded.RequestedUtcTicks, ExpiresUtcTicks = excluded.ExpiresUtcTicks,
                NextAttemptUtcTicks = excluded.NextAttemptUtcTicks, Attempts = 0, LeaseId = '',
                LastFailureType = NULL, SentUtcTicks = NULL
            WHERE PasswordResetDeliveries.RequestedUtcTicks <= {cutoff}
                AND (PasswordResetDeliveries.Status <> 'pending' OR PasswordResetDeliveries.ExpiresUtcTicks <= {now.UtcTicks})
            """, cancellationToken);
        return accepted > 0 ? token : null;
    }

    public async Task DeliverAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow();
        var ticks = now.UtcTicks;
        // Erase recovery payloads at expiry and discard all records after 24 hours.
        await context.PasswordResetDeliveries.Where(d => d.Status == "pending" && d.ExpiresUtcTicks <= ticks)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, "expired").SetProperty(d => d.ProtectedPayload, ""), cancellationToken);
        var retention = now.AddHours(-24).UtcTicks;
        await context.PasswordResetDeliveries.Where(d => d.RequestedUtcTicks < retention).ExecuteDeleteAsync(cancellationToken);
        if (!sender.IsConfigured) return;

        var keys = await context.PasswordResetDeliveries.AsNoTracking()
            .Where(d => d.Status == "pending" && d.NextAttemptUtcTicks <= ticks)
            .OrderBy(d => d.RequestedUtcTicks).Select(d => d.EmailKey).Take(20).ToListAsync(cancellationToken);
        foreach (var key in keys)
        {
            now = clock.GetUtcNow();
            ticks = now.UtcTicks;
            var lease = Guid.NewGuid().ToString("N");
            // Claims last two minutes; SMTP has a 20-second deadline. Count attempts before sending,
            // so repeated process crashes cannot cause unlimited deliveries.
            var claimed = await context.PasswordResetDeliveries
                .Where(d => d.EmailKey == key && d.Status == "pending" && d.NextAttemptUtcTicks <= ticks && d.ExpiresUtcTicks > ticks)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.LeaseId, lease)
                    .SetProperty(d => d.NextAttemptUtcTicks, now.AddMinutes(2).UtcTicks), cancellationToken);
            if (claimed == 0) continue;
            var job = await context.PasswordResetDeliveries.AsNoTracking().SingleAsync(d => d.EmailKey == key, cancellationToken);
            if (job.Attempts >= MaxAttempts)
            {
                await Finish(key, lease, "failed", cancellationToken);
                continue;
            }
            try
            {
                var payload = JsonSerializer.Deserialize<Payload>(protector.Unprotect(job.ProtectedPayload))
                    ?? throw new InvalidOperationException("Invalid recovery payload.");
                var user = payload.UserId is null ? null : await users.FindByIdAsync(payload.UserId);
                if (user is null || user.SecurityStamp != payload.SecurityStamp || users.NormalizeEmail(user.Email) != users.NormalizeEmail(payload.Email) || payload.Token is null)
                {
                    await Finish(key, lease, "cancelled", cancellationToken);
                    continue;
                }
                await context.PasswordResetDeliveries.Where(d => d.EmailKey == key && d.LeaseId == lease)
                    .ExecuteUpdateAsync(s => s.SetProperty(d => d.Attempts, d => d.Attempts + 1), cancellationToken);
                await sender.SendAsync(user.Email!, payload.Token, cancellationToken);
                await context.PasswordResetDeliveries.Where(d => d.EmailKey == key && d.LeaseId == lease)
                    .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, "sent").SetProperty(d => d.ProtectedPayload, "")
                        .SetProperty(d => d.SentUtcTicks, (long?)clock.GetUtcNow().UtcTicks)
                        .SetProperty(d => d.LastFailureType, (string?)null), cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception)
            {
                // Payload corruption/key loss cannot recover through SMTP retries.
                var terminal = exception is CryptographicException or JsonException || job.Attempts + 1 >= MaxAttempts;
                await context.PasswordResetDeliveries.Where(d => d.EmailKey == key && d.LeaseId == lease)
                    .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, terminal ? "failed" : "pending")
                        .SetProperty(d => d.Attempts, job.Attempts + 1)
                        .SetProperty(d => d.ProtectedPayload, terminal ? "" : job.ProtectedPayload)
                        .SetProperty(d => d.LastFailureType, exception.GetType().Name)
                        .SetProperty(d => d.NextAttemptUtcTicks, clock.GetUtcNow().AddMinutes(Math.Pow(2, job.Attempts)).UtcTicks), cancellationToken);
                logger.LogWarning("Password reset delivery {Status} ({FailureType}); attempt {Attempt} of {MaxAttempts}.",
                    terminal ? "failed" : "will retry", exception.GetType().Name, job.Attempts + 1, MaxAttempts);
            }
        }
    }

    private Task<int> Finish(string key, string lease, string status, CancellationToken cancellationToken) =>
        context.PasswordResetDeliveries.Where(d => d.EmailKey == key && d.LeaseId == lease)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, status).SetProperty(d => d.ProtectedPayload, ""), cancellationToken);
}

public sealed class PasswordResetWorker(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<PasswordResetWorker> logger, WorkerHealth health) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (configuration.GetValue<bool>("PasswordReset:DisableWorker")) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        try
        {
            do
            {
                try
                {
                    using var scope = scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<PasswordResetQueue>().DeliverAsync(stoppingToken);
                health.Succeeded("password-reset");
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                catch (Exception exception)
                {
                    logger.LogError("Password reset queue check failed ({FailureType}); retrying in 15 seconds.", exception.GetType().Name);
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
