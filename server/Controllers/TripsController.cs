using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.DTOs;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TripsController(TripPlannerContext context) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Trip>>> GetTrips()
    {
        return Ok(await context.Trips.AsNoTracking().ToListAsync());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Trip>> GetTrip(int id)
    {
        var trip = await context.Trips.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        return trip is null ? NotFound() : Ok(trip);
    }

    [HttpPost]
    public async Task<ActionResult<Trip>> AddTrip(CreateTripRequest request)
    {
        var trip = new Trip
        {
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
        var trip = await context.Trips.FindAsync(id);
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
        var trip = await context.Trips.FindAsync(id);
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
}
