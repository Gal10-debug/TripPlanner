using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using server.Services;

namespace server.Tests;

public class PasswordResetTests
{
    private const string Email = "traveler@example.test";
    private const string OldPassword = "OldPassword123!";
    private const string NewPassword = "NewPassword123!";

    [Fact]
    public async Task Production_delivers_code_and_resets_password_without_exposing_token()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await Register(client);
        var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, result.GetProperty("resetToken").ValueKind);
        var sent = Assert.Single(app.Sender.Messages);
        Assert.Equal(Email, sent.Email);
        Assert.False(string.IsNullOrEmpty(sent.Token));
        Assert.DoesNotContain(sent.Token, await response.Content.ReadAsStringAsync());

        var reset = await client.PostAsJsonAsync("/api/auth/reset-password", new { email = Email, resetToken = sent.Token, newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        var oldLogin = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = Email, password = OldPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
        var newLogin = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = Email, password = NewPassword });
        newLogin.EnsureSuccessStatusCode();
        var replay = await client.PostAsJsonAsync("/api/auth/reset-password", new { email = Email, resetToken = sent.Token, newPassword = OldPassword });
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
    }

    [Fact]
    public async Task Unknown_account_gets_same_response_without_sending_email()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await Register(client);
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "unknown@example.test" });
        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Single(app.Sender.Messages);
    }

    [Fact]
    public async Task Missing_production_email_configuration_is_reported_for_all_accounts()
    {
        using var app = new ResetApplication();
        app.Sender.IsConfigured = false;
        using var client = app.CreateClient();
        await Register(client);
        foreach (var email in new[] { Email, "unknown@example.test" })
        {
            var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        }
        Assert.Empty(app.Sender.Messages);
    }

    [Fact]
    public async Task Delivery_failure_does_not_reveal_account_or_token()
    {
        using var app = new ResetApplication();
        app.Sender.FailDelivery = true;
        using var client = app.CreateClient();
        await Register(client);
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "unknown@example.test" });
        Assert.Equal(HttpStatusCode.OK, known.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Empty(app.Sender.Messages);
    }

    [Fact]
    public async Task Invalid_code_and_weak_password_cannot_reset_an_account()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await Register(client);
        var invalid = await client.PostAsJsonAsync("/api/auth/reset-password", new { email = Email, resetToken = "invalid", newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        var token = Assert.Single(app.Sender.Messages).Token;
        var weak = await client.PostAsJsonAsync("/api/auth/reset-password", new { email = Email, resetToken = token, newPassword = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = Email, password = OldPassword });
        login.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Expired_code_is_rejected()
    {
        using var app = new ResetApplication(expireTokens: true);
        using var client = app.CreateClient();
        await Register(client);
        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        var token = Assert.Single(app.Sender.Messages).Token;
        var reset = await client.PostAsJsonAsync("/api/auth/reset-password", new { email = Email, resetToken = token, newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.BadRequest, reset.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData(null)]
    public async Task Invalid_email_is_rejected(string? email)
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(app.Sender.Messages);
    }

    [Fact]
    public async Task Development_retains_local_token_without_email_configuration()
    {
        using var app = new ResetApplication(environment: "Development");
        app.Sender.IsConfigured = false;
        using var client = app.CreateClient();
        await Register(client);
        var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Email });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(result.GetProperty("resetToken").GetString()));
        Assert.Empty(app.Sender.Messages);
    }

    private static async Task Register(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = OldPassword });
        response.EnsureSuccessStatusCode();
    }
}

internal sealed class ResetApplication(string environment = "Production", bool expireTokens = false) : WebApplicationFactory<Program>
{
    private readonly string databasePath = Path.Combine(Path.GetTempPath(), $"wanderly-reset-{Guid.NewGuid():N}.db");
    public RecordingEmailSender Sender { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:TripPlanner"] = $"Data Source={databasePath};Pooling=False",
            ["Logging:LogLevel:Default"] = "Error",
            ["Notifications:DisableWorker"] = "true"
        }));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPasswordResetEmailSender>();
            services.AddSingleton<IPasswordResetEmailSender>(Sender);
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            if (expireTokens) services.PostConfigure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromSeconds(-1));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            foreach (var suffix in new[] { "", "-wal", "-shm" }) File.Delete(databasePath + suffix);
        }
    }
}

internal sealed class RecordingEmailSender : IPasswordResetEmailSender
{
    public bool IsConfigured { get; set; } = true;
    public bool FailDelivery { get; set; }
    public List<(string Email, string Token)> Messages { get; } = [];
    public Task SendAsync(string email, string token, CancellationToken cancellationToken)
    {
        if (FailDelivery) throw new InvalidOperationException("Simulated email failure");
        Messages.Add((email, token));
        return Task.CompletedTask;
    }
}
