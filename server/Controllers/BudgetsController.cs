using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;

namespace server.Controllers;

[ApiController, Authorize, Route("api/budgets")]
public sealed class BudgetsController(TripPlannerContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var query = db.Trips.AsNoTracking().Where(t => t.UserId == userId || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == userId));
        var trips = await query.OrderByDescending(t => t.StartDate).ToListAsync(ct);
        var expenses = await db.Expenses.AsNoTracking().Where(e => query.Any(t => t.Id == e.TripId)).Select(e => new { e.TripId, e.Amount }).ToListAsync(ct);
        var spent = expenses.GroupBy(e => e.TripId).ToDictionary(g => g.Key, g => g.Sum(e => e.Amount));
        var rows = trips.Select(t => new { t.Id, t.Destination, t.Country, t.StartDate, t.EndDate, currency = t.BudgetCurrency,
            budgetAmount = t.BudgetAmount, totalSpent = spent.GetValueOrDefault(t.Id), remaining = t.BudgetAmount - spent.GetValueOrDefault(t.Id), shared = t.UserId != userId }).ToArray();
        // Currencies are never added together or converted using guessed exchange rates.
        var totals = rows.GroupBy(t => t.currency).OrderBy(g => g.Key).Select(g => new { currency = g.Key,
            budgetAmount = g.Sum(t => t.budgetAmount), totalSpent = g.Sum(t => t.totalSpent), remaining = g.Sum(t => t.remaining), tripCount = g.Count() });
        return Ok(new { trips = rows, totals });
    }
}
