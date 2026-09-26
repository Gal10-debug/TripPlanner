using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.DTOs;
using server.Models;
using server.Services;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TripsController(TripPlannerContext context, TripAccessService access) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Trip>>> GetTrips()
    {
        var trips = await context.Trips
            .AsNoTracking()
            .Include(trip => trip.UsefulLinks)
            .Where(trip => trip.UserId == UserId || context.TripMembers.Any(member => member.TripId == trip.Id && member.UserId == UserId))
            .ToListAsync();
        var sharedIds = trips.Where(trip => trip.UserId != UserId).Select(trip => trip.Id).ToList();
        var roles = await context.TripMembers.AsNoTracking()
            .Where(member => member.UserId == UserId && sharedIds.Contains(member.TripId))
            .ToDictionaryAsync(member => member.TripId, member => member.Role);
        foreach (var trip in trips)
        {
            trip.AccessRole = trip.UserId == UserId ? TripRoles.Owner : roles.GetValueOrDefault(trip.Id, TripRoles.Viewer);
        }
        return Ok(trips);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Trip>> GetTrip(int id)
    {
        if (!await access.CanViewAsync(id, UserId)) return NotFound();
        var trip = await context.Trips.AsNoTracking()
            .Include(t => t.UsefulLinks)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (trip is not null) trip.AccessRole = (await access.GetRoleAsync(id, UserId))!;

        return trip is null ? NotFound() : Ok(trip);
    }

    [HttpPost]
    public async Task<ActionResult<Trip>> AddTrip(CreateTripRequest request)
    {
        var trip = new Trip
        {
            UserId = UserId,
            Destination = request.Destination,
            Country = request.Country,
            StartDate = request.StartDate,
            EndDate = request.EndDate
        };

        context.Trips.Add(trip);
        await context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTrip), new { id = trip.Id }, trip);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTrip(int id)
    {
        if (!await access.IsOwnerAsync(id, UserId)) return NotFound();
        var trip = await context.Trips
            .FirstOrDefaultAsync(t => t.Id == id);
        if (trip == null)
        {
            return NotFound();
        }

        context.Trips.Remove(trip);
        await context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Trip>> UpdateTrip(int id, UpdateTripRequest request)
    {
        if (!await access.CanEditAsync(id, UserId)) return NotFound();
        var trip = await context.Trips
            .FirstOrDefaultAsync(t => t.Id == id);
        if (trip == null)
        {
            return NotFound();
        }

        var hasActivitiesOutsideNewDates = await context.ItineraryItems.AnyAsync(item =>
            item.TripId == id && (item.Date < request.StartDate || item.Date > request.EndDate));
        if (hasActivitiesOutsideNewDates)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["dates"] = ["Move or delete itinerary activities outside the new dates before shortening this trip."]
            }));
        }

        trip.Destination = request.Destination;
        trip.Country = request.Country;
        trip.StartDate = request.StartDate;
        trip.EndDate = request.EndDate;

        await context.SaveChangesAsync();

        trip.AccessRole = (await access.GetRoleAsync(id, UserId))!;
        return Ok(trip);
    }

    [HttpPut("{id}/details")]
    public async Task<ActionResult<Trip>> UpdateTripDetails(int id, UpdateTripDetailsRequest request)
    {
        if (!await access.CanEditAsync(id, UserId)) return NotFound();
        var trip = await context.Trips
            .Include(t => t.UsefulLinks)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (trip is null)
        {
            return NotFound();
        }

        trip.Notes = request.Notes.Trim();
        trip.AccommodationName = request.AccommodationName.Trim();
        trip.AccommodationAddress = request.AccommodationAddress.Trim();
        trip.BookingReference = request.BookingReference.Trim();

        context.TripLinks.RemoveRange(trip.UsefulLinks);
        trip.UsefulLinks = request.UsefulLinks.Select(link => new TripLink
        {
            Label = link.Label.Trim(),
            Url = link.Url.Trim()
        }).ToList();

        await context.SaveChangesAsync();
        trip.AccessRole = (await access.GetRoleAsync(id, UserId))!;
        return Ok(trip);
    }
}
