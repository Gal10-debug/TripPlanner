using Microsoft.AspNetCore.Mvc;
using server.DTOs;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TripsController : ControllerBase
{
    private static readonly List<Trip> Trips = new()
{
    new Trip
    {
        Id = 1,
        Destination = "Tokyo",
        Country = "Japan",
        Days = 10
    },
    new Trip
    {
        Id = 2,
        Destination = "Honolulu",
        Country = "USA",
        Days = 7
    }
};


    [HttpGet]
    public IActionResult GetTrips()
    {
        return Ok(Trips);
    }

    [HttpPost]
    public IActionResult AddTrip(CreateTripRequest request)
    {
        var trip = new Trip
        {
            Id = Trips.Max(t => t.Id) + 1,
            Destination = request.Destination,
            Country = request.Country,
            Days = request.Days
        };

        Trips.Add(trip);

        return CreatedAtAction(nameof(GetTrips), trip);
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteTrip(int id)
    {
        var trip = Trips.FirstOrDefault(t => t.Id == id);
        if (trip == null)
        {
            return NotFound();
        }

        Trips.Remove(trip);
        return NoContent();
    }
}