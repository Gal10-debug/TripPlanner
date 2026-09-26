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
[Route("api/trips/{tripId:int}/packing")]
public class PackingController(TripPlannerContext context, TripAccessService access) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PackingItem>>> GetItems(int tripId)
    {
        if (!await access.CanViewAsync(tripId, UserId)) return NotFound();
        return Ok(await OrderedItems(tripId).AsNoTracking().ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<PackingItem>> AddItem(int tripId, PackingItemRequest request)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();

        var item = NewItem(tripId, request.Name, request.Category, request.Quantity);
        item.IsPacked = request.IsPacked;
        context.PackingItems.Add(item);
        await context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetItems), new { tripId }, item);
    }

    [HttpPut("{itemId:int}")]
    public async Task<ActionResult<PackingItem>> UpdateItem(int tripId, int itemId, PackingItemRequest request)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var item = await context.PackingItems.FirstOrDefaultAsync(item => item.Id == itemId && item.TripId == tripId);
        if (item is null) return NotFound();

        item.Name = request.Name.Trim();
        item.Category = request.Category.Trim();
        item.Quantity = request.Quantity;
        item.IsPacked = request.IsPacked;
        await context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> DeleteItem(int tripId, int itemId)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        var item = await context.PackingItems.FirstOrDefaultAsync(item => item.Id == itemId && item.TripId == tripId);
        if (item is null) return NotFound();

        context.PackingItems.Remove(item);
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("templates/{templateKey}")]
    public async Task<ActionResult<IEnumerable<PackingItem>>> ApplyTemplate(int tripId, string templateKey)
    {
        if (!await access.CanEditAsync(tripId, UserId)) return NotFound();
        if (!Templates.TryGetValue(templateKey, out var template))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["template"] = ["Choose a valid packing template."]
            }));
        }

        var existing = await context.PackingItems.Where(item => item.TripId == tripId).ToListAsync();
        var existingKeys = existing.Select(item => $"{item.Category}|{item.Name}").ToHashSet(StringComparer.OrdinalIgnoreCase);
        var additions = template
            .Where(item => existingKeys.Add($"{item.Category}|{item.Name}"))
            .Select(item => NewItem(tripId, item.Name, item.Category, item.Quantity));

        context.PackingItems.AddRange(additions);
        await context.SaveChangesAsync();
        return Ok(await OrderedItems(tripId).AsNoTracking().ToListAsync());
    }

    private IOrderedQueryable<PackingItem> OrderedItems(int tripId) => context.PackingItems
        .Where(item => item.TripId == tripId)
        .OrderBy(item => item.Category)
        .ThenBy(item => item.Name);

    private static PackingItem NewItem(int tripId, string name, string category, int quantity) => new()
    {
        TripId = tripId,
        Name = name.Trim(),
        Category = category.Trim(),
        Quantity = quantity
    };

    private static readonly Dictionary<string, PackingTemplateItem[]> Templates = new(StringComparer.OrdinalIgnoreCase)
    {
        ["essentials"] =
        [
            new("Passport / ID", "Documents"), new("Wallet", "Documents"), new("Phone charger", "Electronics"),
            new("Medication", "Health"), new("Toothbrush", "Toiletries"), new("Underwear", "Clothing", 5),
            new("Socks", "Clothing", 5)
        ],
        ["beach"] =
        [
            new("Swimsuit", "Clothing", 2), new("Sunscreen", "Toiletries"), new("Sunglasses", "Accessories"),
            new("Beach towel", "Beach gear"), new("Sandals", "Footwear"), new("Reusable water bottle", "Beach gear")
        ],
        ["business"] =
        [
            new("Laptop", "Electronics"), new("Laptop charger", "Electronics"), new("Business outfit", "Clothing", 2),
            new("Dress shoes", "Footwear"), new("Business cards", "Work"), new("Presentation materials", "Work")
        ],
        ["hiking"] =
        [
            new("Hiking boots", "Footwear"), new("Rain jacket", "Clothing"), new("First-aid kit", "Safety"),
            new("Trail map", "Safety"), new("Headlamp", "Gear"), new("Water bottle", "Gear"), new("Trail snacks", "Food", 3)
        ]
    };

    private sealed record PackingTemplateItem(string Name, string Category, int Quantity = 1);
}
