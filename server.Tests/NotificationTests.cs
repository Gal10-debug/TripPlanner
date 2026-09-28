using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using server.Data;
using server.Models;
using server.Services;

namespace server.Tests;

public class NotificationTests
{
    [Fact]
    public async Task Delivery_is_timezone_aware_idempotent_and_filters_completed_reminders()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        var owner = new IdentityUser { UserName = "owner" };
        var member = new IdentityUser { UserName = "member" };
        db.Users.AddRange(owner, member);
        db.AccountSettings.Add(new AccountSettings { UserId = member.Id, TimeZone = "America/Los_Angeles" });
        var trip = new Trip { UserId = owner.Id, Destination = "Rome", Country = "Italy", StartDate = new(2030, 2, 1), EndDate = new(2030, 2, 4) };
        db.Trips.Add(trip);
        await db.SaveChangesAsync();
        db.TripMembers.Add(new TripMember { TripId = trip.Id, UserId = member.Id, Role = "Viewer" });
        db.TripReminders.AddRange(
            new TripReminder { TripId = trip.Id, Title = "Due", DueDate = new(2030, 1, 10) },
            new TripReminder { TripId = trip.Id, Title = "Done", DueDate = new(2030, 1, 9), IsCompleted = true },
            new TripReminder { TripId = trip.Id, Title = "Future", DueDate = new(2030, 1, 11) });
        await db.SaveChangesAsync();
        var service = new NotificationService(db, new ReminderService(db), new FixedClock());
        await service.GenerateAsync();
        await service.GenerateAsync();
        var notification = Assert.Single(await db.UserNotifications.ToListAsync());
        Assert.Equal(owner.Id, notification.UserId);
        Assert.Equal("Due", (await db.TripReminders.FindAsync(notification.ReminderId))!.Title);
        Assert.False(notification.IsRead);
        Assert.Equal(3, await db.TripReminders.CountAsync(r => r.IsAutomatic));
    }

    [Fact]
    public async Task Center_enforces_account_and_trip_access_and_persists_read_state()
    {
        using var app = new ResetApplication();
        using var first = app.CreateClient();
        using var second = app.CreateClient();
        using var anonymous = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/notifications")).StatusCode);
        await Login(first, "first@example.test");
        await Login(second, "second@example.test");
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        var owner = await db.Users.SingleAsync(u => u.Email == "first@example.test");
        var member = await db.Users.SingleAsync(u => u.Email == "second@example.test");
        var trip = new Trip { UserId = owner.Id, Destination = "Rome", Country = "Italy", StartDate = new(2030, 1, 10), EndDate = new(2030, 1, 14) };
        db.Trips.Add(trip);
        await db.SaveChangesAsync();
        var reminder = new TripReminder { TripId = trip.Id, Title = "Book", DueDate = new(2030, 1, 10) };
        db.TripReminders.Add(reminder);
        db.TripMembers.Add(new TripMember { TripId = trip.Id, UserId = member.Id, Role = "Viewer" });
        await db.SaveChangesAsync();
        var own = new UserNotification { UserId = owner.Id, ReminderId = reminder.Id, DueDate = reminder.DueDate };
        var shared = new UserNotification { UserId = member.Id, ReminderId = reminder.Id, DueDate = reminder.DueDate };
        db.UserNotifications.AddRange(own, shared);
        await db.SaveChangesAsync();
        Assert.Single((await first.GetFromJsonAsync<UserNotification[]>("/api/notifications"))!);
        Assert.Single((await second.GetFromJsonAsync<UserNotification[]>("/api/notifications"))!);
        Assert.Equal(HttpStatusCode.NotFound, (await second.PutAsync($"/api/notifications/{own.Id}/read", null)).StatusCode);
        (await first.PutAsync($"/api/notifications/{own.Id}/read", null)).EnsureSuccessStatusCode();
        Assert.True(Assert.Single((await first.GetFromJsonAsync<UserNotification[]>("/api/notifications"))!).IsRead);
        await db.TripMembers.ExecuteDeleteAsync();
        Assert.Empty((await second.GetFromJsonAsync<UserNotification[]>("/api/notifications"))!);
        Assert.Equal(HttpStatusCode.NotFound, (await second.PutAsync($"/api/notifications/{shared.Id}/read", null)).StatusCode);
        reminder.IsCompleted = true;
        await db.SaveChangesAsync();
        Assert.Empty((await first.GetFromJsonAsync<UserNotification[]>("/api/notifications"))!);
    }

    private static async Task Login(HttpClient client, string email)
    {
        var credentials = new { email, password = "Notifications123!" };
        (await client.PostAsJsonAsync("/api/auth/register", credentials)).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login?useCookies=true", credentials)).EnsureSuccessStatusCode();
    }
    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2030, 1, 10, 0, 30, 0, TimeSpan.Zero);
    }
}
