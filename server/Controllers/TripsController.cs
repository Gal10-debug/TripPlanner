using Microsoft.AspNetCore.Mvc;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TripsController : ControllerBase
{
[HttpGet]
public IActionResult GetTrips()
{
    var trips = new List<Trip>
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

    return Ok(trips);
}
}