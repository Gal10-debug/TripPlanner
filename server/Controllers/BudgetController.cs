using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.DTOs;
using server.Models;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/trips/{tripId:int}/budget")]
public class BudgetController(TripPlannerContext context) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult> GetBudget(int tripId)
    {
        var trip = await FindOwnedTrip(tripId);
        return trip is null ? NotFound() : Ok(await BuildOverview(trip));
    }

    [HttpPut]
    public async Task<ActionResult> UpdateBudget(int tripId, UpdateBudgetRequest request)
    {
        var trip = await context.Trips.FirstOrDefaultAsync(trip => trip.Id == tripId && trip.UserId == UserId);
        if (trip is null) return NotFound();

        trip.BudgetAmount = request.Amount;
        trip.BudgetCurrency = request.Currency.ToUpperInvariant();
        await context.SaveChangesAsync();
        return Ok(await BuildOverview(trip));
    }

    [HttpPost("expenses")]
    public async Task<ActionResult> AddExpense(int tripId, ExpenseRequest request)
    {
        var trip = await FindOwnedTrip(tripId);
        if (trip is null) return NotFound();

        context.Expenses.Add(new Expense
        {
            TripId = tripId,
            Description = request.Description.Trim(),
            Amount = request.Amount,
            Category = request.Category.Trim(),
            Date = request.Date
        });
        await context.SaveChangesAsync();
        return Ok(await BuildOverview(trip));
    }

    [HttpPut("expenses/{expenseId:int}")]
    public async Task<ActionResult> UpdateExpense(int tripId, int expenseId, ExpenseRequest request)
    {
        var trip = await FindOwnedTrip(tripId);
        if (trip is null) return NotFound();
        var expense = await context.Expenses.FirstOrDefaultAsync(expense => expense.Id == expenseId && expense.TripId == tripId);
        if (expense is null) return NotFound();

        expense.Description = request.Description.Trim();
        expense.Amount = request.Amount;
        expense.Category = request.Category.Trim();
        expense.Date = request.Date;
        await context.SaveChangesAsync();
        return Ok(await BuildOverview(trip));
    }

    [HttpDelete("expenses/{expenseId:int}")]
    public async Task<ActionResult> DeleteExpense(int tripId, int expenseId)
    {
        var trip = await FindOwnedTrip(tripId);
        if (trip is null) return NotFound();
        var expense = await context.Expenses.FirstOrDefaultAsync(expense => expense.Id == expenseId && expense.TripId == tripId);
        if (expense is null) return NotFound();

        context.Expenses.Remove(expense);
        await context.SaveChangesAsync();
        return Ok(await BuildOverview(trip));
    }

    private Task<Trip?> FindOwnedTrip(int tripId) => context.Trips.AsNoTracking()
        .FirstOrDefaultAsync(trip => trip.Id == tripId && trip.UserId == UserId);

    private async Task<object> BuildOverview(Trip trip)
    {
        var expenses = await context.Expenses.AsNoTracking()
            .Where(expense => expense.TripId == trip.Id)
            .OrderByDescending(expense => expense.Date)
            .ThenByDescending(expense => expense.Id)
            .ToListAsync();
        var totalSpent = expenses.Sum(expense => expense.Amount);
        var currency = string.IsNullOrWhiteSpace(trip.BudgetCurrency) ? "USD" : trip.BudgetCurrency;
        return new
        {
            budgetAmount = trip.BudgetAmount,
            currency,
            totalSpent,
            remaining = trip.BudgetAmount - totalSpent,
            percentUsed = trip.BudgetAmount > 0 ? Math.Round(totalSpent / trip.BudgetAmount * 100, 1) : 0,
            expenses
        };
    }
}
