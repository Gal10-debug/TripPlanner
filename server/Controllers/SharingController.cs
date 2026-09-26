using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.DTOs;
using server.Models;
using server.Services;

namespace server.Controllers;

[ApiController]
[Authorize]
[Route("api/trips/{tripId:int}/sharing")]
public class SharingController(
    TripPlannerContext context,
    TripAccessService access,
    UserManager<IdentityUser> userManager) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult> GetSharing(int tripId)
    {
        var role = await access.GetRoleAsync(tripId, UserId);
        if (role is null) return NotFound();

        var trip = await context.Trips.AsNoTracking().FirstAsync(trip => trip.Id == tripId);
        var ownerEmail = await userManager.Users.Where(user => user.Id == trip.UserId).Select(user => user.Email).FirstAsync();
        var memberRows = await context.TripMembers.AsNoTracking().Where(member => member.TripId == tripId).ToListAsync();
        var memberIds = memberRows.Select(member => member.UserId).ToList();
        var emails = await userManager.Users.Where(user => memberIds.Contains(user.Id)).ToDictionaryAsync(user => user.Id, user => user.Email!);
        var members = memberRows.Select(member => new { member.UserId, email = emails.GetValueOrDefault(member.UserId, "Unknown user"), member.Role });
        var invitations = role == TripRoles.Owner
            ? await context.TripInvitations.AsNoTracking().Where(invitation => invitation.TripId == tripId).OrderBy(invitation => invitation.CreatedAtUtc).Select(invitation => new { invitation.Id, invitation.Email, invitation.Role }).ToListAsync()
            : [];

        return Ok(new { currentUserRole = role, ownerEmail, members, invitations });
    }

    [HttpPost("invitations")]
    public async Task<ActionResult> Invite(int tripId, InviteTripMemberRequest request)
    {
        if (!await access.IsOwnerAsync(tripId, UserId)) return NotFound();
        if (!TripRoles.IsCollaboratorRole(request.Role)) return InvalidRole();

        var normalizedEmail = userManager.NormalizeEmail(request.Email.Trim());
        var ownerEmail = await userManager.Users.Where(user => user.Id == UserId).Select(user => user.NormalizedEmail).FirstAsync();
        if (normalizedEmail == ownerEmail)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["email"] = ["You already own this trip."] }));
        }

        var invitedUser = await userManager.FindByEmailAsync(request.Email.Trim());
        if (invitedUser is not null && await context.TripMembers.AnyAsync(member => member.TripId == tripId && member.UserId == invitedUser.Id))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["email"] = ["This person already has access to the trip."] }));
        }

        var existing = await context.TripInvitations.FirstOrDefaultAsync(invitation => invitation.TripId == tripId && invitation.NormalizedEmail == normalizedEmail);
        if (existing is not null)
        {
            existing.Role = request.Role;
            existing.Email = request.Email.Trim();
        }
        else
        {
            context.TripInvitations.Add(new TripInvitation { TripId = tripId, Email = request.Email.Trim(), NormalizedEmail = normalizedEmail!, Role = request.Role, InvitedByUserId = UserId });
        }

        await context.SaveChangesAsync();
        return await GetSharing(tripId);
    }

    [HttpPut("members/{memberUserId}")]
    public async Task<ActionResult> UpdateMember(int tripId, string memberUserId, UpdateTripMemberRequest request)
    {
        if (!await access.IsOwnerAsync(tripId, UserId)) return NotFound();
        if (!TripRoles.IsCollaboratorRole(request.Role)) return InvalidRole();
        var member = await context.TripMembers.FirstOrDefaultAsync(member => member.TripId == tripId && member.UserId == memberUserId);
        if (member is null) return NotFound();
        member.Role = request.Role;
        await context.SaveChangesAsync();
        return await GetSharing(tripId);
    }

    [HttpDelete("members/{memberUserId}")]
    public async Task<ActionResult> RemoveMember(int tripId, string memberUserId)
    {
        if (!await access.IsOwnerAsync(tripId, UserId)) return NotFound();
        var member = await context.TripMembers.FirstOrDefaultAsync(member => member.TripId == tripId && member.UserId == memberUserId);
        if (member is null) return NotFound();
        context.TripMembers.Remove(member);
        await context.SaveChangesAsync();
        return await GetSharing(tripId);
    }

    [HttpDelete("invitations/{invitationId:int}")]
    public async Task<ActionResult> CancelInvitation(int tripId, int invitationId)
    {
        if (!await access.IsOwnerAsync(tripId, UserId)) return NotFound();
        var invitation = await context.TripInvitations.FirstOrDefaultAsync(invitation => invitation.Id == invitationId && invitation.TripId == tripId);
        if (invitation is null) return NotFound();
        context.TripInvitations.Remove(invitation);
        await context.SaveChangesAsync();
        return await GetSharing(tripId);
    }

    private ActionResult InvalidRole() => ValidationProblem(new ValidationProblemDetails(
        new Dictionary<string, string[]> { ["role"] = ["Role must be Editor or Viewer."] }));
}
