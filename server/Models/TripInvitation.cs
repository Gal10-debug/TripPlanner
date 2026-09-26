namespace server.Models;

public class TripInvitation
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;
    public string Role { get; set; } = TripRoles.Viewer;
    public string InvitedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
