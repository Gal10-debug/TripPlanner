using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace server.Tests;

public class SettingsTests
{
    [Fact]
    public async Task Settings_require_authentication()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/settings")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/settings/options")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync("/api/settings", ValidSettings())).StatusCode);
    }

    [Fact]
    public async Task Preferences_persist_and_are_isolated_between_accounts()
    {
        using var app = new ResetApplication();
        using var first = app.CreateClient();
        using var second = app.CreateClient();
        await RegisterAndLogin(first, "one@example.test");
        await RegisterAndLogin(second, "two@example.test");
        var initial = await first.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal("en", initial.GetProperty("language").GetString());
        Assert.Equal("UTC", initial.GetProperty("timeZone").GetString());
        (await first.PutAsJsonAsync("/api/settings", ValidSettings())).EnsureSuccessStatusCode();
        var saved = await first.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal("גל", saved.GetProperty("displayName").GetString());
        Assert.Equal("he", saved.GetProperty("language").GetString());
        Assert.Equal("Asia/Jerusalem", saved.GetProperty("timeZone").GetString());
        Assert.Equal("one@example.test", saved.GetProperty("email").GetString());
        var other = await second.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal("USD", other.GetProperty("defaultCurrency").GetString());
        Assert.Equal("", other.GetProperty("displayName").GetString());
        using var newSession = app.CreateClient();
        (await newSession.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "one@example.test", password = "Settings123!" })).EnsureSuccessStatusCode();
        var reloaded = await newSession.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal("he", reloaded.GetProperty("language").GetString());
    }

    [Fact]
    public async Task Default_currency_applies_only_to_new_trips()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await RegisterAndLogin(client, "budget@example.test");
        var oldTrip = await CreateTrip(client);
        (await client.PutAsJsonAsync("/api/settings", ValidSettings())).EnsureSuccessStatusCode();
        var newTrip = await CreateTrip(client);
        var oldBudget = await client.GetFromJsonAsync<JsonElement>($"/api/trips/{oldTrip}/budget");
        var newBudget = await client.GetFromJsonAsync<JsonElement>($"/api/trips/{newTrip}/budget");
        Assert.Equal("USD", oldBudget.GetProperty("currency").GetString());
        Assert.Equal("ILS", newBudget.GetProperty("currency").GetString());
    }

    [Theory]
    [InlineData("fr", "UTC", "USD")]
    [InlineData("en", "Invalid/Zone", "USD")]
    [InlineData("en", "UTC", "XXX")]
    public async Task Invalid_preferences_are_rejected_without_changing_saved_settings(string language, string timeZone, string defaultCurrency)
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await RegisterAndLogin(client, "invalid@example.test");
        var response = await client.PutAsJsonAsync("/api/settings", new { displayName = "Name", language, timeZone, defaultCurrency });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var settings = await client.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal("", settings.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Options_include_supported_currency_and_time_zone_values()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await RegisterAndLogin(client, "options@example.test");
        var options = await client.GetFromJsonAsync<JsonElement>("/api/settings/options");
        Assert.Contains(options.GetProperty("currencies").EnumerateArray(), item => item.GetString() == "ILS");
        Assert.Contains(options.GetProperty("timeZones").EnumerateArray(), item => item.GetString() == "Asia/Jerusalem");
    }

    private static object ValidSettings() => new { displayName = "  גל  ", language = "he", timeZone = "Asia/Jerusalem", defaultCurrency = "ILS", email = "cannot-change@example.test", userId = "cannot-change" };
    private static async Task RegisterAndLogin(HttpClient client, string email)
    {
        const string password = "Settings123!";
        (await client.PostAsJsonAsync("/api/auth/register", new { email, password })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email, password })).EnsureSuccessStatusCode();
    }
    private static async Task<int> CreateTrip(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/trips", new { destination = "Rome", country = "Italy", startDate = "2099-01-01", endDate = "2099-01-03" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }
}
