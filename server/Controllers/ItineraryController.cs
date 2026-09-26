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
[Route("api/trips/{tripId:int}/itinerary")]
public class ItineraryController(TripPlannerContext context, TripAccessService access) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ItineraryItem>>> GetItems(int tripId)
    {
        if (!await access.CanViewAsync(tripId, UserId)) return NotFound();

        return Ok(await context.ItineraryItems.AsNoTracking()
            .Where(item => item.TripId == tripId)
            .OrderBy(item => item.Date)
            .ThenBy(item => item.Time)
            .ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<ItineraryItem>> AddItem(int tripId, ItineraryItemRequest request)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var trip = await FindTrip(tripId);
        if (trip is null) return NotFound();
        if (!IsWithinTrip(request.Date, trip)) return InvalidDate(trip);

        var item = new ItineraryItem
        {
            TripId = tripId,
            Title = request.Title.Trim(),
            Date = request.Date,
            Time = request.Time!.Value,
            Location = request.Location.Trim(),
            Note = request.Note.Trim()
        };

        context.ItineraryItems.Add(item);
        await context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetItems), new { tripId }, item);
    }

    [HttpPut("{itemId:int}")]
    public async Task<ActionResult<ItineraryItem>> UpdateItem(int tripId, int itemId, ItineraryItemRequest request)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var trip = await FindTrip(tripId);
        if (trip is null) return NotFound();
        if (!IsWithinTrip(request.Date, trip)) return InvalidDate(trip);

        var item = await context.ItineraryItems
            .FirstOrDefaultAsync(item => item.Id == itemId && item.TripId == tripId);
        if (item is null) return NotFound();

        item.Title = request.Title.Trim();
        item.Date = request.Date;
        item.Time = request.Time!.Value;
        item.Location = request.Location.Trim();
        item.Note = request.Note.Trim();

        await context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> DeleteItem(int tripId, int itemId)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();

        var item = await context.ItineraryItems
            .FirstOrDefaultAsync(item => item.Id == itemId && item.TripId == tripId);
        if (item is null) return NotFound();

        context.ItineraryItems.Remove(item);
        await context.SaveChangesAsync();
        return NoContent();
    }

    private Task<Trip?> FindTrip(int tripId) => context.Trips
        .AsNoTracking()
        .FirstOrDefaultAsync(trip => trip.Id == tripId);

    private static bool IsWithinTrip(DateOnly date, Trip trip) =>
        date >= trip.StartDate && date <= trip.EndDate;

    private ActionResult InvalidDate(Trip trip) => ValidationProblem(new ValidationProblemDetails(
        new Dictionary<string, string[]>
        {
            ["date"] = [$"Activity date must be between {trip.StartDate:yyyy-MM-dd} and {trip.EndDate:yyyy-MM-dd}."]
        }));
}
