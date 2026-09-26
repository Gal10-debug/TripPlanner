using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class ReminderRequest : IValidatableObject
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public DateOnly DueDate { get; set; }

    public bool IsCompleted { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (DueDate == default)
        {
            yield return new ValidationResult("A reminder date is required.", [nameof(DueDate)]);
        }
    }
}
