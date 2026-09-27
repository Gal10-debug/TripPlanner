using Microsoft.EntityFrameworkCore;
using server.Data;

namespace server.Services;

public record ReminderEmail(string Email, string Destination, string Title, DateOnly DueDate, string Language);
public interface IReminderEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(ReminderEmail reminder, CancellationToken cancellationToken);
}
public sealed class ReminderEmailSender(SmtpEmailTransport transport) : IReminderEmailSender
{
    public bool IsConfigured => transport.IsConfigured;
    public Task SendAsync(ReminderEmail reminder, CancellationToken cancellationToken)
    {
        var hebrew = reminder.Language == "he";
        var title = hebrew ? reminder.Title switch
        {
            "Check passports and travel documents" => "בדיקת דרכונים ומסמכי נסיעה",
            "Finish packing and review the checklist" => "סיום האריזה ובדיקת רשימת הציוד",
            "Complete airline check-in" => "ביצוע צ׳ק־אין לטיסה",
            _ => reminder.Title
        } : reminder.Title;
        var body = hebrew
            ? $"תזכורת לטיול: {reminder.Destination}\n{title}\nתאריך: {reminder.DueDate:yyyy-MM-dd}\n\nפתחו את Wanderly לפרטי הטיול. ניתן לכבות תזכורות בדוא״ל בעמוד ההתראות."
            : $"Trip reminder: {reminder.Destination}\n{title}\nDue: {reminder.DueDate:yyyy-MM-dd}\n\nOpen Wanderly for trip details. You can turn off email reminders on the Notifications page.";
        return transport.SendAsync(reminder.Email, hebrew ? "Wanderly — תזכורת לטיול" : "Wanderly — trip reminder", body, cancellationToken);
    }
}

public class ReminderEmailDelivery(TripPlannerContext context, IReminderEmailSender sender, TimeProvider clock, ILogger<ReminderEmailDelivery> logger)
{
    public async Task DeliverAsync(CancellationToken cancellationToken = default)
    {
        if (!sender.IsConfigured) return;
        var now = clock.GetUtcNow();
        var ticks = now.UtcTicks;
        var ids = await context.UserNotifications.AsNoTracking()
            .Where(n => n.EmailStatus == "pending" && n.EmailAttempts < 8 && n.EmailNextAttemptUtcTicks <= ticks)
            .OrderBy(n => n.Id).Select(n => n.Id).Take(50).ToListAsync(cancellationToken);
        foreach (var id in ids)
        {
            now = clock.GetUtcNow();
            ticks = now.UtcTicks;
            // A durable two-minute lease prevents simultaneous delivery by another worker.
            var claimed = await context.UserNotifications.Where(n => n.Id == id && n.EmailStatus == "pending" && n.EmailNextAttemptUtcTicks <= ticks && n.EmailAttempts < 8)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.EmailNextAttemptUtcTicks, now.AddMinutes(2).UtcTicks), cancellationToken);
            if (claimed == 0) continue;
            var notification = await context.UserNotifications.AsNoTracking().SingleOrDefaultAsync(n => n.Id == id, cancellationToken);
            if (notification is null) continue;
            var settings = await context.AccountSettings.AsNoTracking().SingleOrDefaultAsync(s => s.UserId == notification.UserId, cancellationToken);
            var reminder = await context.TripReminders.AsNoTracking().SingleOrDefaultAsync(r => r.Id == notification.ReminderId, cancellationToken);
            var trip = reminder is null ? null : await context.Trips.AsNoTracking().SingleOrDefaultAsync(t => t.Id == reminder.TripId, cancellationToken);
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now.UtcDateTime, TimeZoneInfo.FindSystemTimeZoneById(settings?.TimeZone ?? "UTC")));
            var email = await context.Users.Where(u => u.Id == notification.UserId).Select(u => u.Email).SingleOrDefaultAsync(cancellationToken);
            if (notification.EmailStatus != "pending" || settings?.EmailReminders != true || reminder is null || reminder.IsCompleted || reminder.DueDate != notification.DueDate || reminder.DueDate > today || trip is null || trip.EndDate < today || string.IsNullOrEmpty(email) ||
                (trip.UserId != notification.UserId && !await context.TripMembers.AnyAsync(m => m.TripId == trip.Id && m.UserId == notification.UserId, cancellationToken)))
            {
                await context.UserNotifications.Where(n => n.Id == id).ExecuteUpdateAsync(s => s.SetProperty(n => n.EmailStatus, "cancelled"), cancellationToken);
                continue;
            }
            try
            {
                await sender.SendAsync(new ReminderEmail(email, trip.Destination, reminder.Title, reminder.DueDate, settings.Language), cancellationToken);
                await context.UserNotifications.Where(n => n.Id == id).ExecuteUpdateAsync(s => s.SetProperty(n => n.EmailStatus, "sent").SetProperty(n => n.EmailAttempts, n => n.EmailAttempts + 1), cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception)
            {
                var attempts = notification.EmailAttempts + 1;
                var status = attempts >= 8 ? "failed" : "pending";
                var next = now.AddMinutes(Math.Min(60, Math.Pow(2, attempts))).UtcTicks;
                await context.UserNotifications.Where(n => n.Id == id && n.EmailStatus == "pending")
                    .ExecuteUpdateAsync(s => s.SetProperty(n => n.EmailStatus, status).SetProperty(n => n.EmailAttempts, attempts).SetProperty(n => n.EmailNextAttemptUtcTicks, next), cancellationToken);
                logger.LogWarning("Reminder email delivery failed ({ErrorType}); attempt {Attempt} of 8.", exception.GetType().Name, attempts);
            }
        }
    }
}
