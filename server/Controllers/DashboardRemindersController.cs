using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/reminders")]
public class DashboardRemindersController(TripPlannerContext context, ReminderService reminderService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult> GetUpcomingReminders()
    {
        var zoneId = await context.AccountSettings.Where(settings => settings.UserId == UserId)
            .Select(settings => settings.TimeZone).FirstOrDefaultAsync() ?? "UTC";
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(zoneId)));
        var trips = await context.Trips
            .Where(trip => trip.EndDate >= today && (trip.UserId == UserId || context.TripMembers.Any(member => member.TripId == trip.Id && member.UserId == UserId)))
            .ToListAsync();
        foreach (var trip in trips) await reminderService.EnsureDefaultsAsync(trip);

        var tripIds = trips.Select(trip => trip.Id).ToList();
        var reminders = await context.TripReminders.AsNoTracking()
            .Where(reminder => tripIds.Contains(reminder.TripId) && !reminder.IsCompleted && reminder.DueDate <= today.AddDays(14))
            .Join(context.Trips, reminder => reminder.TripId, trip => trip.Id,
                (reminder, trip) => new { reminder.Id, reminder.TripId, reminder.Title, reminder.DueDate, reminder.IsAutomatic, trip.Destination, trip.Country })
            .OrderBy(reminder => reminder.DueDate)
            .ToListAsync();
        return Ok(reminders);
    }
}
