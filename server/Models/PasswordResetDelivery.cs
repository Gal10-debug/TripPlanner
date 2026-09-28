namespace server.Models;

// Recovery secrets are encrypted with ASP.NET Data Protection, never stored or logged in plaintext.
public sealed class PasswordResetDelivery
{
    public string EmailKey { get; set; } = "";
    public string ProtectedPayload { get; set; } = "";
    public string Status { get; set; } = "pending";
    public long RequestedUtcTicks { get; set; }
    public long ExpiresUtcTicks { get; set; }
    public long NextAttemptUtcTicks { get; set; }
    public int Attempts { get; set; }
    public string LeaseId { get; set; } = "";
    public string? LastFailureType { get; set; }
    public long? SentUtcTicks { get; set; }
}
