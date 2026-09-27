using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Services;

public class NotificationService(TripPlannerContext context, ReminderService reminders, TimeProvider clock)
{
    public async Task GenerateAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var oldestToday = DateOnly.FromDateTime(now.AddDays(-1));
        var trips = await context.Trips.Where(t => t.EndDate >= oldestToday).ToListAsync(cancellationToken);
        foreach (var trip in trips) await reminders.EnsureDefaultsAsync(trip);
        var settings = await context.AccountSettings.AsNoTracking().ToDictionaryAsync(s => s.UserId, cancellationToken);
        var members = await context.TripMembers.AsNoTracking().ToListAsync(cancellationToken);
        var due = await context.TripReminders.AsNoTracking().Where(r => !r.IsCompleted && r.DueDate <= oldestToday.AddDays(2)).ToListAsync(cancellationToken);
        foreach (var trip in trips)
        foreach (var userId in members.Where(m => m.TripId == trip.Id).Select(m => m.UserId).Append(trip.UserId).Distinct())
        {
            var zone = settings.GetValueOrDefault(userId)?.TimeZone ?? "UTC";
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, TimeZoneInfo.FindSystemTimeZoneById(zone)));
            if (trip.EndDate < today) continue;
            foreach (var reminder in due.Where(r => r.TripId == trip.Id && r.DueDate <= today))
            {
                var emailStatus = settings.GetValueOrDefault(userId)?.EmailReminders == true ? "pending" : "none";
                // Atomic insert makes repeated checks and concurrent workers idempotent.
                await context.Database.ExecuteSqlInterpolatedAsync($"INSERT OR IGNORE INTO UserNotifications (UserId, ReminderId, DueDate, IsRead, EmailStatus, EmailAttempts, EmailNextAttemptUtcTicks) VALUES ({userId}, {reminder.Id}, {reminder.DueDate}, {false}, {emailStatus}, 0, 0)", cancellationToken);
            }
        }
    }
}

public class NotificationWorker(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<NotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (configuration.GetValue<bool>("Notifications:DisableWorker")) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<NotificationService>().GenerateAsync(stoppingToken);
                await scope.ServiceProvider.GetRequiredService<ReminderEmailDelivery>().DeliverAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception) { logger.LogError("Reminder notification check failed ({ErrorType}); retrying in one minute.", exception.GetType().Name); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
