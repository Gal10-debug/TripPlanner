namespace server.DTOs;

public class UpdateTripRequest
{
    public string Destination { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public int Days { get; set; }
}
