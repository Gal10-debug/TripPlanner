using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class UpdateTripDetailsRequest
{
    [MaxLength(4000)]
    public string Notes { get; set; } = string.Empty;

    [MaxLength(200)]
    public string AccommodationName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string AccommodationAddress { get; set; } = string.Empty;

    [MaxLength(200)]
    public string BookingReference { get; set; } = string.Empty;

    public List<TripLinkRequest> UsefulLinks { get; set; } = [];
}

public class TripLinkRequest
{
    [Required, MaxLength(100)]
    public string Label { get; set; } = string.Empty;

    [Required, MaxLength(2000), Url]
    public string Url { get; set; } = string.Empty;
}
