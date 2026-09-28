using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;
using server.Services;

namespace server.Controllers;

[ApiController, Authorize, Route("api/notifications")]
public class NotificationsController(TripPlannerContext context, IReminderEmailSender emailSender) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private IQueryable<server.Models.UserNotification> Accessible() => context.UserNotifications.Where(n => n.UserId == UserId &&
        context.TripReminders.Any(r => r.Id == n.ReminderId && r.DueDate == n.DueDate && !r.IsCompleted &&
            context.Trips.Any(t => t.Id == r.TripId && (t.UserId == UserId || context.TripMembers.Any(m => m.TripId == t.Id && m.UserId == UserId)))));

    [HttpGet("preferences")]
    public async Task<IActionResult> Preferences()
    {
        var settings = await context.AccountSettings.AsNoTracking().SingleOrDefaultAsync(s => s.UserId == UserId) ?? new AccountSettings();
        return Ok(new { settings.EmailReminders, settings.BrowserNotifications, emailAvailable = emailSender.IsConfigured });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> SavePreferences(NotificationPreferences request)
    {
        if (request.EmailReminders && !emailSender.IsConfigured)
            return Problem("Email reminders are not configured. Please try again later.", statusCode: 503);
        var settings = await context.AccountSettings.SingleOrDefaultAsync(s => s.UserId == UserId);
        if (settings is null) { settings = new AccountSettings { UserId = UserId }; context.AccountSettings.Add(settings); }
        settings.EmailReminders = request.EmailReminders;
        settings.BrowserNotifications = request.BrowserNotifications;
        await context.SaveChangesAsync();
        if (!request.EmailReminders)
            await context.UserNotifications.Where(n => n.UserId == UserId && n.EmailStatus == "pending")
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.EmailStatus, "cancelled"));
        return await Preferences();
    }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await Accessible()
        .Join(context.TripReminders, n => n.ReminderId, r => r.Id, (n, r) => new { n, r })
        .Join(context.Trips, x => x.r.TripId, t => t.Id, (x, t) => new { x.n.Id, x.n.IsRead, x.n.EmailStatus, x.n.DueDate, x.r.Title, x.r.IsAutomatic, tripId = t.Id, t.Destination })
        .OrderBy(n => n.IsRead).ThenByDescending(n => n.Id).ToListAsync());

    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> Read(int id)
    {
        var changed = await Accessible().Where(n => n.Id == id).ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        return changed == 0 ? NotFound() : NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> ReadAll()
    {
        await Accessible().ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        return NoContent();
    }
}

public record NotificationPreferences(bool EmailReminders, bool BrowserNotifications);
