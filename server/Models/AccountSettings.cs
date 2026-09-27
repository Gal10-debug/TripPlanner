using System.ComponentModel.DataAnnotations;

namespace server.Models;

public class AccountSettings
{
    [Key]
    public string UserId { get; set; } = "";
    [MaxLength(100)]
    public string DisplayName { get; set; } = "";
    public string Language { get; set; } = "en";
    public string TimeZone { get; set; } = "UTC";
    public string DefaultCurrency { get; set; } = "USD";
}
