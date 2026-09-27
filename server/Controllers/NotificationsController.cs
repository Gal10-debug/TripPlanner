using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;

namespace server.Controllers;

[ApiController, Authorize, Route("api/notifications")]
public class NotificationsController(TripPlannerContext context) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private IQueryable<server.Models.UserNotification> Accessible() => context.UserNotifications.Where(n => n.UserId == UserId &&
        context.TripReminders.Any(r => r.Id == n.ReminderId && r.DueDate == n.DueDate && !r.IsCompleted &&
            context.Trips.Any(t => t.Id == r.TripId && (t.UserId == UserId || context.TripMembers.Any(m => m.TripId == t.Id && m.UserId == UserId)))));

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await Accessible()
        .Join(context.TripReminders, n => n.ReminderId, r => r.Id, (n, r) => new { n, r })
        .Join(context.Trips, x => x.r.TripId, t => t.Id, (x, t) => new { x.n.Id, x.n.IsRead, x.n.DueDate, x.r.Title, x.r.IsAutomatic, tripId = t.Id, t.Destination })
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
