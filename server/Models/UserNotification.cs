namespace server.Models;

public class UserNotification
{
    public string EmailStatus { get; set; } = "none";
    public int EmailAttempts { get; set; }
    public long EmailNextAttemptUtcTicks { get; set; }
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public int ReminderId { get; set; }
    public DateOnly DueDate { get; set; }
    public bool IsRead { get; set; }
}
