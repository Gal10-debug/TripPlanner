using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using server.Data;
using server.Models;

namespace server.Tests;

public class CalendarTests
{
    [Fact]
    public async Task Anonymous_requests_require_authentication()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/api/calendar?month=2027-01");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(TripRoles.Viewer)]
    [InlineData(TripRoles.Editor)]
    public async Task Month_includes_owned_and_shared_trips_and_activities_only(string role)
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        var ids = await Seed(app, role);
        await Login(client);
        var response = await client.GetAsync("/api/calendar?month=2027-01");
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        var trips = result.GetProperty("trips").EnumerateArray().ToArray();
        Assert.Equal(new[] { ids.Spanning, ids.Owned, ids.Shared }.Order(), trips.Select(trip => trip.GetProperty("id").GetInt32()).Order());
        var activities = result.GetProperty("activities").EnumerateArray().ToArray();
        Assert.Equal(new[] { "New year breakfast", "New year museum", "Last day" }, activities.Select(item => item.GetProperty("title").GetString()));
        Assert.Equal("2026-12-30", trips.Single(trip => trip.GetProperty("id").GetInt32() == ids.Owned).GetProperty("startDate").GetString());
        Assert.Equal("2027-02-02", trips.Single(trip => trip.GetProperty("id").GetInt32() == ids.Shared).GetProperty("endDate").GetString());
        Assert.DoesNotContain("Private trip", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Revoked_membership_removes_shared_trip_and_activities()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        var ids = await Seed(app, TripRoles.Viewer);
        await Login(client);
        using (var scope = app.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
            database.TripMembers.Remove(database.TripMembers.Single(member => member.TripId == ids.Shared));
            await database.SaveChangesAsync();
        }
        var result = await client.GetFromJsonAsync<JsonElement>("/api/calendar?month=2027-01");
        Assert.DoesNotContain(result.GetProperty("trips").EnumerateArray(), trip => trip.GetProperty("id").GetInt32() == ids.Shared);
        Assert.DoesNotContain(result.GetProperty("activities").EnumerateArray(), item => item.GetProperty("tripId").GetInt32() == ids.Shared);
    }

    [Theory]
    [InlineData("")]
    [InlineData("?month=2027-13")]
    [InlineData("?month=2027-1")]
    [InlineData("?month=0000-01")]
    [InlineData("?month=not-a-date")]
    public async Task Invalid_months_are_rejected(string query)
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await Seed(app, TripRoles.Viewer);
        await Login(client);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/calendar{query}")).StatusCode);
    }

    [Theory]
    [InlineData("2028-02")]
    [InlineData("9999-12")]
    [InlineData("0001-01")]
    public async Task Empty_month_returns_empty_lists_including_date_boundaries(string month)
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await Seed(app, TripRoles.Viewer);
        await Login(client);
        var result = await client.GetFromJsonAsync<JsonElement>($"/api/calendar?month={month}");
        Assert.Empty(result.GetProperty("trips").EnumerateArray());
        Assert.Empty(result.GetProperty("activities").EnumerateArray());
    }

    [Fact]
    public async Task Leap_day_activities_are_included_in_february()
    {
        using var app = new ResetApplication();
        using var client = app.CreateClient();
        await Seed(app, TripRoles.Viewer);
        using (var scope = app.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
            var user = database.Users.Single(user => user.Email == "calendar@example.test");
            var trip = MakeTrip(user.Id, "Leap trip", "2028-02-28", "2028-03-01");
            database.Trips.Add(trip);
            database.ItineraryItems.Add(MakeItem(trip, "Leap day", "2028-02-29", 10));
            await database.SaveChangesAsync();
        }
        await Login(client);
        var result = await client.GetFromJsonAsync<JsonElement>("/api/calendar?month=2028-02");
        Assert.Single(result.GetProperty("trips").EnumerateArray());
        Assert.Equal("Leap day", Assert.Single(result.GetProperty("activities").EnumerateArray()).GetProperty("title").GetString());
    }

    private static async Task Login(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "calendar@example.test", password = "Calendar123!" });
        response.EnsureSuccessStatusCode();
    }

    private static async Task<(int Owned, int Shared, int Spanning)> Seed(ResetApplication app, string role)
    {
        using var scope = app.Services.CreateScope();
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var user = new IdentityUser { UserName = "calendar@example.test", Email = "calendar@example.test" };
        var other = new IdentityUser { UserName = "other@example.test", Email = "other@example.test" };
        Assert.True((await manager.CreateAsync(user, "Calendar123!")).Succeeded);
        Assert.True((await manager.CreateAsync(other, "Calendar123!")).Succeeded);
        var database = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
        var owned = MakeTrip(user.Id, "Owned trip", "2026-12-30", "2027-01-02");
        var shared = MakeTrip(other.Id, "Shared trip", "2027-01-31", "2027-02-02");
        var spanning = MakeTrip(user.Id, "Long journey", "2026-12-01", "2027-02-28");
        var hidden = MakeTrip(other.Id, "Private trip", "2027-01-01", "2027-01-31");
        database.Trips.AddRange(owned, shared, spanning, hidden,
            MakeTrip(user.Id, "Before month", "2026-12-01", "2026-12-31"),
            MakeTrip(user.Id, "After month", "2027-02-01", "2027-02-02"));
        await database.SaveChangesAsync();
        database.TripMembers.Add(new TripMember { TripId = shared.Id, UserId = user.Id, Role = role });
        database.ItineraryItems.AddRange(
            MakeItem(owned, "Previous year", "2026-12-31", 10),
            MakeItem(owned, "New year museum", "2027-01-01", 14),
            MakeItem(owned, "New year breakfast", "2027-01-01", 8),
            MakeItem(shared, "Last day", "2027-01-31", 12),
            MakeItem(shared, "Next month", "2027-02-01", 12),
            MakeItem(hidden, "Private activity", "2027-01-01", 12));
        await database.SaveChangesAsync();
        return (owned.Id, shared.Id, spanning.Id);
    }

    private static Trip MakeTrip(string userId, string destination, string start, string end) => new()
    {
        UserId = userId, Destination = destination, Country = "Italy", StartDate = DateOnly.Parse(start), EndDate = DateOnly.Parse(end)
    };
    private static ItineraryItem MakeItem(Trip trip, string title, string date, int hour) => new()
    {
        Trip = trip, Title = title, Date = DateOnly.Parse(date), Time = new TimeOnly(hour, 0)
    };
}
