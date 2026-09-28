using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/calendar")]
public class CalendarController(TripPlannerContext context) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMonth([FromQuery] string? month, CancellationToken cancellationToken)
    {
        if (month?.Length != 7 || !DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd",
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var start))
            return BadRequest(new { detail = "Choose a month in YYYY-MM format." });

        var end = new DateOnly(start.Year, start.Month, DateTime.DaysInMonth(start.Year, start.Month));
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var accessibleTrips = context.Trips.AsNoTracking().Where(trip => trip.UserId == userId
            || context.TripMembers.Any(member => member.TripId == trip.Id && member.UserId == userId));

        var trips = await accessibleTrips
            .Where(trip => trip.StartDate <= end && trip.EndDate >= start)
            .OrderBy(trip => trip.StartDate).ThenBy(trip => trip.Destination).ThenBy(trip => trip.Id)
            .Select(trip => new { trip.Id, trip.Destination, trip.Country, trip.StartDate, trip.EndDate })
            .ToListAsync(cancellationToken);
        var activities = await (from item in context.ItineraryItems.AsNoTracking()
                                join trip in accessibleTrips on item.TripId equals trip.Id
                                where item.Date >= start && item.Date <= end
                                orderby item.Date, item.Time, item.Id
                                select new { item.Id, item.TripId, item.Title, item.Date, item.Time, item.Location, trip.Destination, trip.Country })
            .ToListAsync(cancellationToken);

        return Ok(new { trips, activities });
    }
}
