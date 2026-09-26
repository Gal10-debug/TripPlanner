using System.Text.Json.Serialization;

namespace server.Models;

public class Expense
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public DateOnly Date { get; set; }

    [JsonIgnore]
    public Trip Trip { get; set; } = null!;
}
