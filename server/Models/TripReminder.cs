using System.Text.Json.Serialization;

namespace server.Models;

public class TripReminder
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateOnly DueDate { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsAutomatic { get; set; }

    [JsonIgnore]
    public Trip Trip { get; set; } = null!;
}
