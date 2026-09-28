using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using server.Data;
using server.Infrastructure;

namespace server.Tests;

public class ProductionSystemTests
{
    private const string Password = "SystemTests123!";
    private static async Task<HttpClient> User(ResetApplication app, string name)
    {
        var client = app.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/register", new { email = name + "@example.test", password = Password })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = name + "@example.test", password = Password })).EnsureSuccessStatusCode();
        return client;
    }
    private static async Task<int> Trip(HttpClient client, string destination = "Rome")
    {
        var response = await client.PostAsJsonAsync("/api/trips", new { destination, country = "Italy", startDate = "2099-06-01", endDate = "2099-06-05" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Liveness_readiness_and_private_monitoring_have_distinct_access()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/ops/status")).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", "test-monitoring-token");
        var status = await client.GetFromJsonAsync<JsonElement>("/ops/status");
        Assert.Equal("degraded", status.GetProperty("status").GetString()); // Workers are disabled in tests.
        Assert.False(status.TryGetProperty("email", out _));
        using var scope = app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<TripPlannerContext>().Database.ExecuteSqlRawAsync("DROP TABLE Trips");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
    }

    [Fact]
    public void Worker_heartbeat_expires_when_a_job_stops_completing()
    {
        var clock = new ResetClock();
        var health = new WorkerHealth(clock);
        health.Succeeded("notifications");
        Assert.True(health.IsHealthy("notifications"));
        clock.Advance(TimeSpan.FromMinutes(6));
        Assert.False(health.IsHealthy("notifications"));
        health.Succeeded("notifications");
        Assert.True(health.IsHealthy("notifications"));
    }

    [Fact]
    public async Task Production_redirects_http_and_allows_only_configured_CORS_origin()
    {
        using var app = new ResetApplication();
        using var http = app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost"), AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.TemporaryRedirect, (await http.GetAsync("/api/auth/me")).StatusCode);
        using var client = app.CreateClient();
        foreach (var origin in new[] { "https://localhost", "https://attacker.example" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/trips");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "GET");
            var response = await client.SendAsync(request);
            Assert.Equal(origin == "https://localhost", response.Headers.Contains("Access-Control-Allow-Origin"));
        }
    }

    [Fact]
    public async Task Budgets_keep_currencies_separate_and_exclude_other_accounts()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "budget-owner");
        using var other = await User(app, "budget-other");
        var dollarTrip = await Trip(owner);
        var euroTrip = await Trip(owner, "Florence");
        await Trip(other, "Private destination");
        (await owner.PutAsJsonAsync($"/api/trips/{dollarTrip}/budget", new { amount = 500, currency = "USD" })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/trips/{euroTrip}/budget", new { amount = 1000, currency = "EUR" })).EnsureSuccessStatusCode();
        (await owner.PostAsJsonAsync($"/api/trips/{dollarTrip}/budget/expenses", new { amount = 125, description = "Hotel", category = "Accommodation", date = "2099-06-01" })).EnsureSuccessStatusCode();
        var budgets = await owner.GetFromJsonAsync<JsonElement>("/api/budgets");
        Assert.Equal(2, budgets.GetProperty("trips").GetArrayLength());
        var totals = budgets.GetProperty("totals").EnumerateArray().ToArray();
        Assert.Equal(2, totals.Length);
        Assert.Equal(375, totals.Single(t => t.GetProperty("currency").GetString() == "USD").GetProperty("remaining").GetDecimal());
        Assert.DoesNotContain("Private destination", budgets.ToString());
    }

    [Fact]
    public async Task Export_and_deletion_require_password_and_only_affect_the_current_account()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "privacy-owner");
        using var other = await User(app, "privacy-other");
        using var staleSession = app.CreateClient();
        (await staleSession.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "privacy-owner@example.test", password = Password })).EnsureSuccessStatusCode();
        var id = await Trip(owner);
        var otherId = await Trip(other, "Other private trip");
        var bad = await owner.PostAsJsonAsync("/api/account/export", new { password = "wrong" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var export = await owner.PostAsJsonAsync("/api/account/export", new { password = Password });
        export.EnsureSuccessStatusCode();
        var text = await export.Content.ReadAsStringAsync();
        Assert.Contains("privacy-owner@example.test", text);
        Assert.DoesNotContain("Other private trip", text);
        Assert.DoesNotContain("passwordHash", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("securityStamp", text, StringComparison.OrdinalIgnoreCase);
        Assert.True(export.Headers.CacheControl?.NoStore);
        var denied = await owner.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password, confirmation = "wrong" }) });
        Assert.Equal(HttpStatusCode.BadRequest, denied.StatusCode);
        var deleted = await owner.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password, confirmation = "DELETE" }) });
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await staleSession.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync($"/api/trips/{otherId}")).StatusCode);
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        Assert.False(await db.Trips.AnyAsync(t => t.Id == id));
        Assert.False(await db.Users.AnyAsync(u => u.Email == "privacy-owner@example.test"));
    }
}
