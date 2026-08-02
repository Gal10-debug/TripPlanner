using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models;

public class Trip
{
    public int Id { get; set; }

    public string Destination { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    [NotMapped]
    public int Days => EndDate.DayNumber - StartDate.DayNumber + 1;
}
