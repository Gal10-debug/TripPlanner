using System.Text.Json.Serialization;

namespace server.Models;

public class TripLink
{
    public int Id { get; set; }

    public int TripId { get; set; }

    public string Label { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;

    [JsonIgnore]
    public Trip Trip { get; set; } = null!;
}
