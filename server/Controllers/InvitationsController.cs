using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/sharing/invitations")]
public class InvitationsController(TripPlannerContext context, UserManager<IdentityUser> userManager) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult> GetInvitations()
    {
        var normalizedEmail = User.FindFirstValue(ClaimTypes.Email)?.ToUpperInvariant()
            ?? await userManager.Users.Where(user => user.Id == UserId).Select(user => user.NormalizedEmail).FirstAsync();

        var invitations = await context.TripInvitations.AsNoTracking()
            .Where(invitation => invitation.NormalizedEmail == normalizedEmail)
            .Join(context.Trips, invitation => invitation.TripId, trip => trip.Id,
                (invitation, trip) => new { invitation.Id, invitation.TripId, trip.Destination, trip.Country, invitation.Role, invitation.Email })
            .ToListAsync();
        return Ok(invitations);
    }

    [HttpPost("{invitationId:int}/accept")]
    public async Task<IActionResult> Accept(int invitationId)
    {
        var invitation = await FindForCurrentUser(invitationId);
        if (invitation is null) return NotFound();

        if (!await context.TripMembers.AnyAsync(member => member.TripId == invitation.TripId && member.UserId == UserId))
        {
            context.TripMembers.Add(new TripMember { TripId = invitation.TripId, UserId = UserId, Role = invitation.Role });
        }
        context.TripInvitations.Remove(invitation);
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{invitationId:int}/decline")]
    public async Task<IActionResult> Decline(int invitationId)
    {
        var invitation = await FindForCurrentUser(invitationId);
        if (invitation is null) return NotFound();
        context.TripInvitations.Remove(invitation);
        await context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<TripInvitation?> FindForCurrentUser(int invitationId)
    {
        var normalizedEmail = await userManager.Users.Where(user => user.Id == UserId).Select(user => user.NormalizedEmail).FirstAsync();
        return await context.TripInvitations.FirstOrDefaultAsync(invitation => invitation.Id == invitationId && invitation.NormalizedEmail == normalizedEmail);
    }
}
