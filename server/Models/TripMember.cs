namespace server.Models;

public class TripMember
{
    public int TripId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = TripRoles.Viewer;
}

public static class TripRoles
{
    public const string Owner = "Owner";
    public const string Editor = "Editor";
    public const string Viewer = "Viewer";

    public static bool IsCollaboratorRole(string role) => role is Editor or Viewer;
}
