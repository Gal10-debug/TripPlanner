namespace server.Models;

public class UserNotification
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public int ReminderId { get; set; }
    public DateOnly DueDate { get; set; }
    public bool IsRead { get; set; }
}
