using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace server.Models;

public class Trip
{
    public int Id { get; set; }

    [JsonIgnore]
    public string UserId { get; set; } = string.Empty;

    public string Destination { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public string Notes { get; set; } = string.Empty;

    public string AccommodationName { get; set; } = string.Empty;

    public string AccommodationAddress { get; set; } = string.Empty;

    public string BookingReference { get; set; } = string.Empty;

    public decimal BudgetAmount { get; set; }

    public string BudgetCurrency { get; set; } = "USD";

    public List<TripLink> UsefulLinks { get; set; } = [];

    [NotMapped]
    public int Days => EndDate.DayNumber - StartDate.DayNumber + 1;

    [NotMapped]
    public string AccessRole { get; set; } = TripRoles.Owner;
}
