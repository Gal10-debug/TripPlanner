using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class PackingItemRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string Category { get; set; } = string.Empty;

    [Range(1, 99)]
    public int Quantity { get; set; } = 1;

    public bool IsPacked { get; set; }
}
