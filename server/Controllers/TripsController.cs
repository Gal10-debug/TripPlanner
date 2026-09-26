using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.DTOs;
using server.Models;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TripsController(TripPlannerContext context) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Trip>>> GetTrips()
    {
        return Ok(await context.Trips
            .AsNoTracking()
            .Include(trip => trip.UsefulLinks)
            .Where(trip => trip.UserId == UserId)
            .ToListAsync());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Trip>> GetTrip(int id)
    {
        var trip = await context.Trips.AsNoTracking()
            .Include(t => t.UsefulLinks)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);

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
        var trip = await context.Trips
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
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
        var trip = await context.Trips
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
        if (trip == null)
        {
            return NotFound();
        }

        trip.Destination = request.Destination;
        trip.Country = request.Country;
        trip.StartDate = request.StartDate;
        trip.EndDate = request.EndDate;

        await context.SaveChangesAsync();

        return Ok(trip);
    }

    [HttpPut("{id}/details")]
    public async Task<ActionResult<Trip>> UpdateTripDetails(int id, UpdateTripDetailsRequest request)
    {
        var trip = await context.Trips
            .Include(t => t.UsefulLinks)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
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
        return Ok(trip);
    }
}
