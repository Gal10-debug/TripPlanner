using System.Text.Json.Serialization;

namespace server.Models;

public class PackingItem
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public bool IsPacked { get; set; }

    [JsonIgnore]
    public Trip Trip { get; set; } = null!;
}
