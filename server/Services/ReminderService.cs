using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Services;

public class ReminderService(TripPlannerContext context)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly (string Title, int DaysBefore)[] Defaults =
    [
        ("Check passports and travel documents", 14),
        ("Finish packing and review the checklist", 2),
        ("Complete airline check-in", 1)
    ];

    public async Task EnsureDefaultsAsync(Trip trip)
    {
        await Gate.WaitAsync();
        try
        {
        var existing = await context.TripReminders
            .Where(reminder => reminder.TripId == trip.Id && reminder.IsAutomatic)
            .ToListAsync();

        foreach (var definition in Defaults)
        {
            var dueDate = trip.StartDate.AddDays(-definition.DaysBefore);
            var reminder = existing.FirstOrDefault(item => item.Title == definition.Title);
            if (reminder is null)
            {
                context.TripReminders.Add(new TripReminder { TripId = trip.Id, Title = definition.Title, DueDate = dueDate, IsAutomatic = true });
            }
            else
            {
                reminder.DueDate = dueDate;
            }
        }

        await context.SaveChangesAsync();
        }
        finally { Gate.Release(); }
    }
}
