using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Services;

public class TripAccessService(TripPlannerContext context)
{
    public async Task<string?> GetRoleAsync(int tripId, string userId)
    {
        if (await context.Trips.AnyAsync(trip => trip.Id == tripId && trip.UserId == userId))
        {
            return TripRoles.Owner;
        }

        return await context.TripMembers
            .Where(member => member.TripId == tripId && member.UserId == userId)
            .Select(member => member.Role)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> CanViewAsync(int tripId, string userId) =>
        await GetRoleAsync(tripId, userId) is not null;

    public async Task<bool> CanEditAsync(int tripId, string userId) =>
        await GetRoleAsync(tripId, userId) is TripRoles.Owner or TripRoles.Editor;

    public Task<bool> IsOwnerAsync(int tripId, string userId) =>
        context.Trips.AnyAsync(trip => trip.Id == tripId && trip.UserId == userId);
}
