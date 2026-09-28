using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;

namespace server.Controllers;

[ApiController, Authorize, Route("api/account")]
public sealed class AccountPrivacyController(TripPlannerContext db, UserManager<IdentityUser> users, SignInManager<IdentityUser> signIn) : ControllerBase
{
    private async Task<IdentityUser?> Reauthenticate(string password)
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return null;
        // Count failed password confirmations toward the account's Identity lockout.
        var check = await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        return check.Succeeded ? user : null;
    }

    [HttpPost("export")]
    public async Task<IActionResult> Export(ConfirmPassword request, CancellationToken ct)
    {
        var user = await Reauthenticate(request.Password);
        if (user is null) return BadRequest(new { detail = "Unable to confirm your password. Please try again later." });
        var owned = db.Trips.AsNoTracking().Where(t => t.UserId == user.Id);
        var result = new
        {
            version = 1, exportedAt = DateTimeOffset.UtcNow,
            profile = new { user.Email, user.EmailConfirmed },
            preferences = await db.AccountSettings.AsNoTracking().SingleOrDefaultAsync(s => s.UserId == user.Id, ct),
            trips = await owned.Include(t => t.UsefulLinks).ToListAsync(ct),
            itinerary = await db.ItineraryItems.AsNoTracking().Where(i => owned.Any(t => t.Id == i.TripId)).ToListAsync(ct),
            packing = await db.PackingItems.AsNoTracking().Where(i => owned.Any(t => t.Id == i.TripId)).ToListAsync(ct),
            expenses = await db.Expenses.AsNoTracking().Where(i => owned.Any(t => t.Id == i.TripId)).ToListAsync(ct),
            reminders = await db.TripReminders.AsNoTracking().Where(i => owned.Any(t => t.Id == i.TripId)).ToListAsync(ct),
            memberships = await db.TripMembers.AsNoTracking().Where(m => m.UserId == user.Id).Select(m => new { m.TripId, m.Role }).ToListAsync(ct),
            invitations = await db.TripInvitations.AsNoTracking().Where(i => i.NormalizedEmail == user.NormalizedEmail || i.InvitedByUserId == user.Id).Select(i => new { i.TripId, i.Email, i.Role, i.CreatedAtUtc }).ToListAsync(ct),
            notifications = await db.UserNotifications.AsNoTracking().Where(n => n.UserId == user.Id).ToListAsync(ct)
        };
        Response.Headers.CacheControl = "no-store";
        return File(JsonSerializer.SerializeToUtf8Bytes(result, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }), "application/json", "tripplanner-account.json");
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(DeleteAccount request, CancellationToken ct)
    {
        if (request.Confirmation != "DELETE") return BadRequest(new { detail = "Type DELETE to confirm account deletion." });
        var user = await Reauthenticate(request.Password);
        if (user is null) return BadRequest(new { detail = "Unable to confirm your password. Please try again later." });
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(users.NormalizeEmail(user.Email) ?? "")));
        await db.PasswordResetDeliveries.Where(d => d.EmailKey == key).ExecuteDeleteAsync(ct);
        await db.TripInvitations.Where(i => i.NormalizedEmail == user.NormalizedEmail || i.InvitedByUserId == user.Id).ExecuteDeleteAsync(ct);
        // Owned trips and their details cascade; memberships are removed without deleting others' trips.
        var result = await users.DeleteAsync(user);
        if (!result.Succeeded) return Problem(statusCode: 503, detail: "Unable to delete the account. Please try again.");
        await transaction.CommitAsync(ct);
        await signIn.SignOutAsync();
        return NoContent();
    }
}
public record ConfirmPassword([Required, MaxLength(1024)] string Password);
public record DeleteAccount([Required, MaxLength(1024)] string Password, [Required] string Confirmation);
