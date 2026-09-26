using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class InviteTripMemberRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = "Viewer";
}

public class UpdateTripMemberRequest
{
    [Required]
    public string Role { get; set; } = "Viewer";
}
