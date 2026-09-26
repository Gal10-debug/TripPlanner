using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.DTOs;
using server.Models;
using server.Services;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/trips/{tripId:int}/reminders")]
public class RemindersController(
    TripPlannerContext context,
    TripAccessService access,
    ReminderService reminderService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TripReminder>>> GetReminders(int tripId)
    {
        if (!await access.CanViewAsync(tripId, UserId)) return NotFound();
        var trip = await context.Trips.AsNoTracking().FirstAsync(trip => trip.Id == tripId);
        await reminderService.EnsureDefaultsAsync(trip);
        return Ok(await OrderedReminders(tripId).AsNoTracking().ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<TripReminder>> AddReminder(int tripId, ReminderRequest request)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var reminder = new TripReminder { TripId = tripId, Title = request.Title.Trim(), DueDate = request.DueDate, IsCompleted = request.IsCompleted };
        context.TripReminders.Add(reminder);
        await context.SaveChangesAsync();
        return Ok(reminder);
    }

    [HttpPut("{reminderId:int}")]
    public async Task<ActionResult<TripReminder>> UpdateReminder(int tripId, int reminderId, ReminderRequest request)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var reminder = await context.TripReminders.FirstOrDefaultAsync(reminder => reminder.Id == reminderId && reminder.TripId == tripId);
        if (reminder is null) return NotFound();

        reminder.Title = reminder.IsAutomatic ? reminder.Title : request.Title.Trim();
        reminder.DueDate = reminder.IsAutomatic ? reminder.DueDate : request.DueDate;
        reminder.IsCompleted = request.IsCompleted;
        await context.SaveChangesAsync();
        return Ok(reminder);
    }

    [HttpDelete("{reminderId:int}")]
    public async Task<IActionResult> DeleteReminder(int tripId, int reminderId)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var reminder = await context.TripReminders.FirstOrDefaultAsync(reminder => reminder.Id == reminderId && reminder.TripId == tripId && !reminder.IsAutomatic);
        if (reminder is null) return NotFound();
        context.TripReminders.Remove(reminder);
        await context.SaveChangesAsync();
        return NoContent();
    }

    private IOrderedQueryable<TripReminder> OrderedReminders(int tripId) => context.TripReminders
        .Where(reminder => reminder.TripId == tripId)
        .OrderBy(reminder => reminder.IsCompleted)
        .ThenBy(reminder => reminder.DueDate);
}
