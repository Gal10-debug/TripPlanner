namespace server.Models;

public class Trip
{
    public int Id { get; set; }

    public string Destination { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public int Days { get; set; }
}