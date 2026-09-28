using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using server.Data;
using server.Models;
using server.Services;

namespace server.Tests;

public class ReminderEmailTests
{
    [Fact]
    public async Task Preferences_are_opt_in_isolated_and_unavailable_email_cannot_be_enabled()
    {
        using var app = new ResetApplication();
        using var first = await Login(app, "first");
        using var second = await Login(app, "second");
        using var anonymous = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/notifications/preferences")).StatusCode);
        var initial = await first.GetFromJsonAsync<JsonElement>("/api/notifications/preferences");
        Assert.False(initial.GetProperty("emailReminders").GetBoolean());
        Assert.False(initial.GetProperty("browserNotifications").GetBoolean());
        (await first.PutAsJsonAsync("/api/notifications/preferences", new { emailReminders = true, browserNotifications = true })).EnsureSuccessStatusCode();
        (await first.PutAsJsonAsync("/api/settings", new { displayName = "Traveler", language = "he", timeZone = "UTC", defaultCurrency = "USD" })).EnsureSuccessStatusCode();
        var saved = await first.GetFromJsonAsync<JsonElement>("/api/notifications/preferences");
        Assert.True(saved.GetProperty("emailReminders").GetBoolean());
        Assert.True(saved.GetProperty("browserNotifications").GetBoolean());
        Assert.False((await second.GetFromJsonAsync<JsonElement>("/api/notifications/preferences")).GetProperty("emailReminders").GetBoolean());
        app.ReminderSender.IsConfigured = false;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await second.PutAsJsonAsync("/api/notifications/preferences", new { emailReminders = true, browserNotifications = true })).StatusCode);
        Assert.False((await second.GetFromJsonAsync<JsonElement>("/api/notifications/preferences")).GetProperty("browserNotifications").GetBoolean());
        (await first.PutAsJsonAsync("/api/notifications/preferences", new { emailReminders = false, browserNotifications = false })).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Newly_queued_email_is_sent_once_and_old_notifications_are_not_replayed()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        var (settings, trip, _) = await Seed(db, false);
        var clock = new ManualClock();
        var generator = new NotificationService(db, new ReminderService(db), clock);
        await generator.GenerateAsync();
        settings.EmailReminders = true;
        db.TripReminders.Add(new TripReminder { TripId = trip.Id, Title = "New reminder", DueDate = new(2030, 1, 10) });
        await db.SaveChangesAsync();
        await generator.GenerateAsync();
        await Delivery(db, app, clock).DeliverAsync();
        await Delivery(db, app, clock).DeliverAsync();
        var message = Assert.Single(app.ReminderSender.Messages);
        Assert.Equal("New reminder", message.Title);
        Assert.Equal("recipient@example.test", message.Email);
        Assert.Equal("he", message.Language);
        Assert.Equal(1, await db.UserNotifications.CountAsync(n => n.EmailStatus == "sent"));
    }

    [Fact]
    public async Task Failed_delivery_waits_before_retry_and_recovers_without_duplicate_sends()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        await Seed(db);
        var clock = new ManualClock();
        await new NotificationService(db, new ReminderService(db), clock).GenerateAsync();
        app.ReminderSender.FailDelivery = true;
        await Delivery(db, app, clock).DeliverAsync();
        app.ReminderSender.FailDelivery = false;
        await Delivery(db, app, clock).DeliverAsync();
        Assert.Empty(app.ReminderSender.Messages);
        clock.AdvanceMinutes(3);
        await Delivery(db, app, clock).DeliverAsync();
        await Delivery(db, app, clock).DeliverAsync();
        Assert.Single(app.ReminderSender.Messages);
        var sent = await db.UserNotifications.AsNoTracking().SingleAsync(n => n.EmailStatus == "sent");
        Assert.Equal(2, sent.EmailAttempts);
    }

    [Fact]
    public async Task Eight_failed_attempts_stop_retrying_and_retain_visible_failure_status()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        await Seed(db);
        var clock = new ManualClock();
        await new NotificationService(db, new ReminderService(db), clock).GenerateAsync();
        app.ReminderSender.FailDelivery = true;
        for (var attempt = 0; attempt < 9; attempt++) { await Delivery(db, app, clock).DeliverAsync(); clock.AdvanceMinutes(61); }
        var failed = await db.UserNotifications.AsNoTracking().SingleAsync(n => n.EmailStatus == "failed");
        Assert.Equal(8, failed.EmailAttempts);
        Assert.Empty(app.ReminderSender.Messages);
    }

    [Theory]
    [InlineData("opt-out")]
    [InlineData("completed")]
    [InlineData("rescheduled")]
    [InlineData("revoked")]
    [InlineData("trip-ended")]
    public async Task Obsolete_or_unauthorized_email_is_cancelled_before_sending(string reason)
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        var (settings, trip, reminder) = await Seed(db);
        var clock = new ManualClock();
        await new NotificationService(db, new ReminderService(db), clock).GenerateAsync();
        switch (reason)
        {
            case "opt-out": settings.EmailReminders = false; break;
            case "completed": reminder.IsCompleted = true; break;
            case "rescheduled": reminder.DueDate = reminder.DueDate.AddDays(1); break;
            case "revoked": await db.TripMembers.ExecuteDeleteAsync(); break;
            case "trip-ended": trip.EndDate = new(2030, 1, 9); break;
        }
        await db.SaveChangesAsync();
        await Delivery(db, app, clock).DeliverAsync();
        Assert.Empty(app.ReminderSender.Messages);
        Assert.Equal(1, await db.UserNotifications.CountAsync(n => n.EmailStatus == "cancelled"));
    }

    [Fact]
    public async Task An_active_lease_prevents_delivery_and_an_expired_lease_can_recover()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        await Seed(db);
        var clock = new ManualClock();
        await new NotificationService(db, new ReminderService(db), clock).GenerateAsync();
        await db.UserNotifications.Where(n => n.EmailStatus == "pending").ExecuteUpdateAsync(s => s.SetProperty(n => n.EmailNextAttemptUtcTicks, clock.GetUtcNow().AddMinutes(2).UtcTicks));
        await Delivery(db, app, clock).DeliverAsync();
        Assert.Empty(app.ReminderSender.Messages);
        clock.AdvanceMinutes(3);
        await Delivery(db, app, clock).DeliverAsync();
        Assert.Single(app.ReminderSender.Messages);
    }

    private static ReminderEmailDelivery Delivery(TripPlannerContext db, ResetApplication app, TimeProvider clock) => new(db, app.ReminderSender, clock, NullLogger<ReminderEmailDelivery>.Instance);
    private static async Task<(AccountSettings, Trip, TripReminder)> Seed(TripPlannerContext db, bool enabled = true)
    {
        var owner = new IdentityUser { UserName = "owner", Email = "owner@example.test" };
        var recipient = new IdentityUser { UserName = "recipient", Email = "recipient@example.test" };
        db.Users.AddRange(owner, recipient);
        var settings = new AccountSettings { UserId = recipient.Id, EmailReminders = enabled, Language = "he" };
        db.AccountSettings.Add(settings);
        var trip = new Trip { UserId = owner.Id, Destination = "Rome", Country = "Italy", StartDate = new(2030, 2, 1), EndDate = new(2030, 2, 5) };
        db.Trips.Add(trip);
        await db.SaveChangesAsync();
        var reminder = new TripReminder { TripId = trip.Id, Title = "Book tickets", DueDate = new(2030, 1, 10) };
        db.TripReminders.Add(reminder);
        db.TripMembers.Add(new TripMember { TripId = trip.Id, UserId = recipient.Id, Role = "Viewer" });
        await db.SaveChangesAsync();
        return (settings, trip, reminder);
    }
    private static async Task<HttpClient> Login(ResetApplication app, string name)
    {
        var client = app.CreateClient();
        var credentials = new { email = $"{name}@example.test", password = "ReminderTests123!" };
        (await client.PostAsJsonAsync("/api/auth/register", credentials)).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login?useCookies=true", credentials)).EnsureSuccessStatusCode();
        return client;
    }
    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset now = new(2030, 1, 10, 0, 30, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => now;
        public void AdvanceMinutes(int minutes) => now = now.AddMinutes(minutes);
    }
}
