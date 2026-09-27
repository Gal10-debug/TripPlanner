using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/settings")]
public class SettingsController(TripPlannerContext context) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private static readonly string[] Currencies = ["USD", "EUR", "GBP", "ILS", "JPY", "CAD", "AUD"];
    private static readonly string[] TimeZones = TimeZoneInfo.GetSystemTimeZones().Select(zone => zone.Id)
        .Append("UTC").Distinct().Order(StringComparer.Ordinal).ToArray();

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var settings = await context.AccountSettings.AsNoTracking().SingleOrDefaultAsync(item => item.UserId == UserId)
            ?? new AccountSettings();
        return Ok(ToResponse(settings));
    }

    [HttpGet("options")]
    public IActionResult GetOptions() => Ok(new { currencies = Currencies, timeZones = TimeZones });

    [HttpPut]
    public async Task<IActionResult> UpdateSettings(UpdateSettingsRequest request)
    {
        if (request.Language is not ("en" or "he")) ModelState.AddModelError("language", "Choose English or Hebrew.");
        if (!TimeZones.Contains(request.TimeZone)) ModelState.AddModelError("timeZone", "Choose a supported time zone.");
        if (!Currencies.Contains(request.DefaultCurrency)) ModelState.AddModelError("defaultCurrency", "Choose a supported currency.");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var settings = await context.AccountSettings.SingleOrDefaultAsync(item => item.UserId == UserId);
        if (settings is null)
        {
            settings = new AccountSettings { UserId = UserId };
            context.AccountSettings.Add(settings);
        }
        settings.DisplayName = request.DisplayName.Trim();
        settings.Language = request.Language;
        settings.TimeZone = request.TimeZone;
        settings.DefaultCurrency = request.DefaultCurrency;
        await context.SaveChangesAsync();
        return Ok(ToResponse(settings));
    }

    private object ToResponse(AccountSettings settings) => new
    {
        email = User.Identity!.Name, settings.DisplayName, settings.Language, settings.TimeZone, settings.DefaultCurrency
    };
}

public record UpdateSettingsRequest(
    [Required(AllowEmptyStrings = true), MaxLength(100)] string DisplayName,
    [Required] string Language,
    [Required] string TimeZone,
    [Required] string DefaultCurrency);
