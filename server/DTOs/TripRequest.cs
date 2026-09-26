using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public abstract class TripRequest : IValidatableObject
{
    [Required]
    public string Destination { get; set; } = string.Empty;

    [Required]
    public string Country { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (StartDate == default)
        {
            yield return new ValidationResult(
                "A start date is required.",
                [nameof(StartDate)]);
        }

        if (EndDate == default)
        {
            yield return new ValidationResult(
                "An end date is required.",
                [nameof(EndDate)]);
        }
        else if (StartDate != default && EndDate < StartDate)
        {
            yield return new ValidationResult(
                "The end date cannot be before the start date.",
                [nameof(EndDate)]);
        }
    }
}
