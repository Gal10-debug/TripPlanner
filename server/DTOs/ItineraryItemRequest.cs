using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class ItineraryItemRequest : IValidatableObject
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    [Required]
    public TimeOnly? Time { get; set; }

    [MaxLength(300)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Note { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
        {
            yield return new ValidationResult("An activity date is required.", [nameof(Date)]);
        }
    }
}
