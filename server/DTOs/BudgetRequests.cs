using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class UpdateBudgetRequest
{
    [Range(typeof(decimal), "0", "999999999")]
    public decimal Amount { get; set; }

    [Required, RegularExpression("^[A-Z]{3}$", ErrorMessage = "Currency must be a three-letter code.")]
    public string Currency { get; set; } = "USD";
}

public class ExpenseRequest : IValidatableObject
{
    [Required, MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.01", "999999999")]
    public decimal Amount { get; set; }

    [Required, MaxLength(80)]
    public string Category { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
        {
            yield return new ValidationResult("An expense date is required.", [nameof(Date)]);
        }
    }
}
