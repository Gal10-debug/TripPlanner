using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using server.Services;
using server.Data;
using Microsoft.EntityFrameworkCore;

namespace server.Tests;

public class PasswordResetReliabilityTests
{
    private const string Email = "traveler@example.test";
    private const string Password = "OldPassword123!";

    private static async Task<HttpClient> RegisteredClient(ResetApplication app)
    {
        var client = app.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password })).EnsureSuccessStatusCode();
        return client;
    }
    private static Task<HttpResponseMessage> Request(HttpClient client, string email = Email) =>
        client.PostAsJsonAsync("/api/auth/forgot-password", new { email });

    [Fact]
    public async Task Cooldown_is_case_insensitive_durable_and_does_not_reveal_suppression()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        var first = await Request(client);
        await app.DeliverPasswordResets();
        var repeated = await Request(client, "  TRAVELER@example.test  ");
        Assert.Equal(await first.Content.ReadAsStringAsync(), await repeated.Content.ReadAsStringAsync());
        await app.DeliverPasswordResets();
        Assert.Single(app.Sender.Messages);
        Assert.Single(await app.ResetJobs());
        app.Clock.Advance(TimeSpan.FromMinutes(5));
        (await Request(client)).EnsureSuccessStatusCode();
        await app.DeliverPasswordResets();
        Assert.Equal(2, app.Sender.Messages.Count);
    }

    [Fact]
    public async Task Concurrent_requests_create_only_one_delivery()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => Request(client)));
        foreach (var response in responses) response.EnsureSuccessStatusCode();
        Assert.Single(await app.ResetJobs());
        await Task.WhenAll(app.DeliverPasswordResets(), app.DeliverPasswordResets());
        Assert.Single(app.Sender.Messages);
    }

    [Fact]
    public async Task Failed_email_is_retried_from_a_new_scope_and_secrets_are_erased_after_success()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        await Request(client);
        var queued = Assert.Single(await app.ResetJobs());
        Assert.DoesNotContain(Email, queued.ProtectedPayload);
        Assert.DoesNotContain(Email, queued.EmailKey);
        app.Sender.FailDelivery = true;
        await app.DeliverPasswordResets();
        var failedAttempt = Assert.Single(await app.ResetJobs());
        Assert.Equal("pending", failedAttempt.Status);
        Assert.Equal(1, failedAttempt.Attempts);
        Assert.Equal("InvalidOperationException", failedAttempt.LastFailureType);
        app.Sender.FailDelivery = false;
        await app.DeliverPasswordResets(); // Retry is not due yet.
        Assert.Empty(app.Sender.Messages);
        app.Clock.Advance(TimeSpan.FromMinutes(1));
        await app.DeliverPasswordResets();
        Assert.Single(app.Sender.Messages);
        var sent = Assert.Single(await app.ResetJobs());
        Assert.Equal("sent", sent.Status);
        Assert.Equal(2, sent.Attempts);
        Assert.Empty(sent.ProtectedPayload);
        Assert.NotNull(sent.SentUtcTicks);
        Assert.Null(sent.LastFailureType);
    }

    [Fact]
    public async Task Repeated_failures_stop_at_five_attempts_and_keep_only_safe_status()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        await Request(client);
        app.Sender.FailDelivery = true;
        for (var attempt = 0; attempt < 5; attempt++)
        {
            await app.DeliverPasswordResets();
            app.Clock.Advance(TimeSpan.FromMinutes(Math.Pow(2, attempt)));
        }
        var job = Assert.Single(await app.ResetJobs());
        Assert.Equal("failed", job.Status);
        Assert.Equal(5, job.Attempts);
        Assert.Empty(job.ProtectedPayload);
        app.Sender.FailDelivery = false;
        await app.DeliverPasswordResets();
        Assert.Empty(app.Sender.Messages);
    }

    [Fact]
    public async Task Expired_jobs_are_not_delivered_and_records_are_pruned()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        await Request(client);
        app.Clock.Advance(TimeSpan.FromHours(1));
        await app.DeliverPasswordResets();
        var expired = Assert.Single(await app.ResetJobs());
        Assert.Equal("expired", expired.Status);
        Assert.Empty(expired.ProtectedPayload);
        Assert.Empty(app.Sender.Messages);
        app.Clock.Advance(TimeSpan.FromHours(24));
        await app.DeliverPasswordResets();
        Assert.Empty(await app.ResetJobs());
    }

    [Fact]
    public async Task Password_change_cancels_pending_reset_email()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        await Request(client);
        using (var scope = app.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
            var user = (await users.FindByEmailAsync(Email))!;
            Assert.True((await users.ChangePasswordAsync(user, Password, "ChangedPassword123!")).Succeeded);
        }
        await app.DeliverPasswordResets();
        Assert.Empty(app.Sender.Messages);
        Assert.Equal("cancelled", Assert.Single(await app.ResetJobs()).Status);
    }

    [Fact]
    public async Task Unknown_addresses_follow_the_same_cooldown_without_sending()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        var first = await Request(client, "unknown@example.test");
        await app.DeliverPasswordResets();
        var repeat = await Request(client, "UNKNOWN@example.test");
        Assert.Equal(await first.Content.ReadAsStringAsync(), await repeat.Content.ReadAsStringAsync());
        Assert.Single(await app.ResetJobs());
        Assert.Empty(app.Sender.Messages);
    }

    [Fact]
    public async Task Queue_survives_application_restart_with_a_persisted_key_ring()
    {
        var directory = Directory.CreateTempSubdirectory("tripplanner-reset-restart-");
        try
        {
            var database = Path.Combine(directory.FullName, "reset.db");
            var keys = Directory.CreateDirectory(Path.Combine(directory.FullName, "keys"));
            using (var first = new ResetApplication(sharedDatabasePath: database, keyDirectory: keys))
            using (var client = await RegisteredClient(first))
            {
                (await Request(client)).EnsureSuccessStatusCode();
                Assert.Empty(first.Sender.Messages);
            }
            using (var restarted = new ResetApplication(sharedDatabasePath: database, keyDirectory: keys))
            using (var client = restarted.CreateClient())
            {
                await restarted.DeliverPasswordResets();
                var sent = Assert.Single(restarted.Sender.Messages);
                var response = await client.PostAsJsonAsync("/api/auth/reset-password", new { email = Email, resetToken = sent.Token, newPassword = "NewPassword123!" });
                Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
                await Request(client); // The address cooldown survives the restart too.
                await restarted.DeliverPasswordResets();
                Assert.Single(restarted.Sender.Messages);
            }
        }
        finally { directory.Delete(recursive: true); }
    }

    [Fact]
    public async Task Queue_persistence_failure_is_reported_instead_of_claiming_acceptance()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
            await db.Database.ExecuteSqlRawAsync("DROP TABLE PasswordResetDeliveries");
        }
        foreach (var email in new[] { Email, "unknown@example.test" })
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await Request(client, email)).StatusCode);
        Assert.Empty(app.Sender.Messages);
    }

    [Fact]
    public async Task Identity_forgot_password_alias_uses_the_same_queue_and_cooldown()
    {
        using var app = new ResetApplication();
        using var client = await RegisteredClient(app);
        (await client.PostAsJsonAsync("/api/auth/forgotPassword", new { email = Email })).EnsureSuccessStatusCode();
        await Request(client);
        Assert.Single(await app.ResetJobs());
        await app.DeliverPasswordResets();
        Assert.Single(app.Sender.Messages);
    }

    [Fact]
    public async Task Recovery_routes_share_IP_limit_and_ignore_spoofed_forwarding_headers()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        for (var i = 0; i < 10; i++)
        {
            client.DefaultRequestHeaders.Remove("X-Forwarded-For");
            client.DefaultRequestHeaders.Add("X-Forwarded-For", $"192.0.2.{i}");
            (await Request(client, $"unknown{i}@example.test")).EnsureSuccessStatusCode();
        }
        foreach (var route in new[] { "forgot-password", "reset-password", "forgotPassword", "resetPassword" })
        {
            var response = await client.PostAsJsonAsync($"/api/auth/{route}", new { email = Email });
            Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
            Assert.NotNull(response.Headers.RetryAfter);
            Assert.DoesNotContain(Email, await response.Content.ReadAsStringAsync());
        }
        // This limiter must not block unrelated application requests.
        (await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password })).EnsureSuccessStatusCode();
    }
}
