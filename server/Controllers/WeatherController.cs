using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/trips/{tripId:int}/weather")]
public class WeatherController(TripPlannerContext context, TripAccessService access, WeatherService weather) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult> GetWeather(int tripId)
    {
        if (!await access.CanViewAsync(tripId, UserId)) return NotFound();
        var trip = await context.Trips.AsNoTracking().FirstAsync(trip => trip.Id == tripId);
        try
        {
            return Ok(await weather.GetForecastAsync(trip));
        }
        catch (HttpRequestException)
        {
            return Problem("The weather service is temporarily unavailable. Please try again later.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (TaskCanceledException)
        {
            return Problem("The weather service took too long to respond. Please try again later.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}
