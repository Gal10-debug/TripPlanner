using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;

namespace server.Infrastructure;

public sealed class WorkerHealth(TimeProvider clock)
{
    private readonly ConcurrentDictionary<string, DateTimeOffset> successes = new();
    private readonly DateTimeOffset started = clock.GetUtcNow();
    public void Succeeded(string worker) => successes[worker] = clock.GetUtcNow();
    public bool IsHealthy(string worker) => clock.GetUtcNow() - successes.GetValueOrDefault(worker, started) < TimeSpan.FromMinutes(5);
}

public static class Operations
{
    public static void MapOperations(this WebApplication app)
    {
        app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));
        app.MapGet("/health/ready", async (TripPlannerContext db, CancellationToken ct) =>
        {
            try { await db.Trips.AsNoTracking().Select(t => t.Id).Take(1).ToListAsync(ct); return Results.Ok(new { status = "ready" }); }
            catch { return Results.Json(new { status = "unavailable" }, statusCode: 503); }
        });
        app.MapGet("/ops/status", async (HttpContext http, IConfiguration config, TripPlannerContext db, WorkerHealth workers, IPasswordResetEmailSender smtp, TimeProvider clock, CancellationToken ct) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            var expected = config["Monitoring:Token"];
            var actual = http.Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(expected) || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(actual)), SHA256.HashData(Encoding.UTF8.GetBytes("Bearer " + expected))))
                return Results.NotFound();
            try
            {
                var cutoff = clock.GetUtcNow().AddMinutes(-5).UtcTicks;
                var resetPending = await db.PasswordResetDeliveries.CountAsync(d => d.Status == "pending", ct);
                var resetOverdue = await db.PasswordResetDeliveries.CountAsync(d => d.Status == "pending" && d.NextAttemptUtcTicks < cutoff, ct);
                var resetFailed = await db.PasswordResetDeliveries.CountAsync(d => d.Status == "failed", ct);
                var reminderPending = await db.UserNotifications.CountAsync(n => n.EmailStatus == "pending", ct);
                var reminderOverdue = await db.UserNotifications.CountAsync(n => n.EmailStatus == "pending" && n.EmailNextAttemptUtcTicks < cutoff, ct);
                var reminderFailed = await db.UserNotifications.CountAsync(n => n.EmailStatus == "failed", ct);
                var workerHealthy = !config.GetValue<bool>("Notifications:DisableWorker") && !config.GetValue<bool>("PasswordReset:DisableWorker")
                    && workers.IsHealthy("notifications") && workers.IsHealthy("password-reset");
                var healthy = workerHealthy && smtp.IsConfigured && resetOverdue + reminderOverdue + resetFailed + reminderFailed == 0 && resetPending + reminderPending < 100;
                return Results.Json(new { status = healthy ? "healthy" : "degraded", database = "ready", workerHealthy, smtpConfigured = smtp.IsConfigured,
                    resetPending, resetOverdue, resetFailed, reminderPending, reminderOverdue, reminderFailed });
            }
            catch { return Results.Json(new { status = "unavailable", database = "unavailable" }, statusCode: 503); }
        });
    }
}
