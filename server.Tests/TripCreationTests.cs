using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using server.Data;

namespace server.Tests;

public class TripCreationTests
{
    [Fact]
    public async Task Creation_date_is_server_recorded_and_preserved_on_edits()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        const string email = "creation@example.test";
        const string password = "Creation123!";
        (await client.PostAsJsonAsync("/api/auth/register", new { email, password })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email, password })).EnsureSuccessStatusCode();
        var before = DateTimeOffset.UtcNow;
        var created = await client.PostAsJsonAsync("/api/trips", new
        {
            destination = "Rome", country = "Italy", startDate = "2099-01-01", endDate = "2099-01-03", createdAt = "2000-01-01T00:00:00Z"
        });
        created.EnsureSuccessStatusCode();
        var trip = await created.Content.ReadFromJsonAsync<JsonElement>();
        var timestamp = trip.GetProperty("createdAt").GetDateTimeOffset();
        Assert.InRange(timestamp, before, DateTimeOffset.UtcNow);
        var id = trip.GetProperty("id").GetInt32();
        var edited = await client.PutAsJsonAsync($"/api/trips/{id}", new
        {
            destination = "Venice", country = "Italy", startDate = "2099-02-01", endDate = "2099-02-03", createdAt = "2001-01-01T00:00:00Z"
        });
        edited.EnsureSuccessStatusCode();
        var updatedTrip = await edited.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(timestamp, updatedTrip.GetProperty("createdAt").GetDateTimeOffset());
        var list = await client.GetFromJsonAsync<JsonElement>("/api/trips");
        Assert.Equal(timestamp, Assert.Single(list.EnumerateArray()).GetProperty("createdAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Migration_preserves_existing_trips_without_inventing_creation_dates()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<TripPlannerContext>().UseSqlite(connection).Options;
        await using var database = new TripPlannerContext(options);
        var migrator = database.GetService<IMigrator>();
        await migrator.MigrateAsync("20260926203118_AddWeatherReminders");
        var user = new IdentityUser { UserName = "legacy@example.test", Email = "legacy@example.test" };
        database.Users.Add(user);
        await database.SaveChangesAsync();
        await database.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Trips" ("UserId", "Destination", "Country", "StartDate", "EndDate", "Notes", "AccommodationName", "AccommodationAddress", "BookingReference", "BudgetAmount", "BudgetCurrency")
            VALUES ({user.Id}, 'Legacy Rome', 'Italy', '2026-09-01', '2026-09-03', 'Keep my notes', '', '', '', '0', 'USD')
            """);
        await migrator.MigrateAsync();
        var trip = await database.Trips.SingleAsync();
        Assert.Null(trip.CreatedAt);
        Assert.Equal("Legacy Rome", trip.Destination);
        Assert.Equal("Keep my notes", trip.Notes);
    }
}
