using System.Text.Json.Serialization;

namespace server.Models;

public class ItineraryItem
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public TimeOnly Time { get; set; }
    public string Location { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;

    [JsonIgnore]
    public Trip Trip { get; set; } = null!;
}
