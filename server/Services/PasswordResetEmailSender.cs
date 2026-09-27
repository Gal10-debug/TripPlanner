using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace server.Services;

public interface IPasswordResetEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(string email, string token, CancellationToken cancellationToken);
}

public sealed class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string FromAddress { get; set; } = "";
    public string FromName { get; set; } = "Wanderly";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public bool UseImplicitTls { get; set; }
}

public sealed class PasswordResetEmailSender(IOptions<SmtpOptions> options) : IPasswordResetEmailSender
{
    private readonly SmtpOptions settings = options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(settings.Host)
        && settings.Port is > 0 and <= 65535
        && MailboxAddress.TryParse(settings.FromAddress, out _)
        && (string.IsNullOrEmpty(settings.Username) == string.IsNullOrEmpty(settings.Password));

    public async Task SendAsync(string email, string token, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("Password reset email is not configured.");

        using var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.FromAddress));
        message.To.Add(MailboxAddress.Parse(email));
        message.Subject = "Reset your Wanderly password";
        message.Body = new TextPart("plain")
        {
            Text = $"""
                A password reset was requested for your Wanderly account.

                Return to Wanderly, select "Forgot your password?", then "I already have a reset code".
                Enter this email address, paste the full code below, and choose a new password.
                The code expires after one hour and can only be used once.

                {token}

                If you did not request this, you can ignore this email. Your password has not changed.
                """
        };

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(20));
        using var client = new SmtpClient { Timeout = 15000 };
        // Require TLS; never fall back to sending account recovery codes in clear text.
        await client.ConnectAsync(settings.Host, settings.Port,
            settings.UseImplicitTls ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, deadline.Token);
        if (!string.IsNullOrEmpty(settings.Username))
            await client.AuthenticateAsync(settings.Username, settings.Password, deadline.Token);
        await client.SendAsync(message, deadline.Token);
        await client.DisconnectAsync(true, deadline.Token);
    }
}
