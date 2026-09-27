using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace server.Tests;

public class CriticalTripFlowTests
{
    private static object Trip(string destination = "Rome", string endDate = "2030-01-05") => new
    { destination, country = "Italy", startDate = "2030-01-01", endDate };
    private static object Expense(decimal amount = 12.50m) => new
    { description = " Museum tickets ", amount, category = " Activities ", date = "2030-01-02" };
    private static async Task<HttpClient> User(ResetApplication app, string name)
    {
        var client = app.CreateClient();
        var credentials = new { email = $"{name}@example.test", password = "TripFlows123!" };
        (await client.PostAsJsonAsync("/api/auth/register", credentials)).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login?useCookies=true", credentials)).EnsureSuccessStatusCode();
        return client;
    }
    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
    private static async Task<int> Create(HttpClient client) => (await Json(await client.PostAsJsonAsync("/api/trips", Trip()))).GetProperty("id").GetInt32();
    private static async Task<JsonElement> Budget(HttpClient client, int id) => await Json(await client.GetAsync($"/api/trips/{id}/budget"));
    private static async Task<int> Invite(HttpClient owner, int trip, string name, string role)
    {
        var result = await Json(await owner.PostAsJsonAsync($"/api/trips/{trip}/sharing/invitations", new { email = $"{name}@example.test", role }));
        return result.GetProperty("invitations")[0].GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Trip_details_persist_and_date_edits_preserve_existing_activities()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        var id = await Create(owner);
        var details = new { notes = " Flight at noon ", accommodationName = " Hotel ", accommodationAddress = " 10 Main Street ", bookingReference = " ABC123 ", usefulLinks = new[] { new { label = " Booking ", url = "https://example.test/booking" } } };
        (await owner.PutAsJsonAsync($"/api/trips/{id}/details", details)).EnsureSuccessStatusCode();
        (await owner.PostAsJsonAsync($"/api/trips/{id}/itinerary", new { title = "Museum", date = "2030-01-04", time = "09:00:00", location = "Main Street", note = "Tickets ready" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/trips/{id}", Trip("Venice", "2030-01-03"))).StatusCode);
        var unchanged = await Json(await owner.GetAsync($"/api/trips/{id}"));
        Assert.Equal("Rome", unchanged.GetProperty("destination").GetString());
        Assert.Equal("2030-01-05", unchanged.GetProperty("endDate").GetString());
        (await owner.PutAsJsonAsync($"/api/trips/{id}", Trip("Venice", "2030-01-06"))).EnsureSuccessStatusCode();
        using var fresh = app.CreateClient();
        (await fresh.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "owner@example.test", password = "TripFlows123!" })).EnsureSuccessStatusCode();
        var saved = await Json(await fresh.GetAsync($"/api/trips/{id}"));
        Assert.Equal("Venice", saved.GetProperty("destination").GetString());
        Assert.Equal("ABC123", saved.GetProperty("bookingReference").GetString());
        Assert.Equal("10 Main Street", saved.GetProperty("accommodationAddress").GetString());
        Assert.Equal("Booking", saved.GetProperty("usefulLinks")[0].GetProperty("label").GetString());
        Assert.Single((await Json(await fresh.GetAsync($"/api/trips/{id}/itinerary"))).EnumerateArray());
    }

    [Theory]
    [InlineData("", "2030-01-05")]
    [InlineData("Rome", "2029-12-31")]
    public async Task Invalid_trip_creation_does_not_persist_a_trip(string destination, string endDate)
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/trips", Trip(destination, endDate))).StatusCode);
        Assert.Empty((await Json(await owner.GetAsync("/api/trips"))).EnumerateArray());
    }

    [Fact]
    public async Task Sharing_invitation_role_changes_and_revocation_enforce_permissions()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        using var member = await User(app, "member");
        using var stranger = await User(app, "stranger");
        var id = await Create(owner);
        var invitation = await Invite(owner, id, "member", "Viewer");
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsync($"/api/sharing/invitations/{invitation}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"/api/trips/{id}")).StatusCode);
        (await member.PostAsync($"/api/sharing/invitations/{invitation}/accept", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await member.PostAsync($"/api/sharing/invitations/{invitation}/accept", null)).StatusCode);
        Assert.Equal("Viewer", (await Json(await member.GetAsync($"/api/trips/{id}"))).GetProperty("accessRole").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await member.PutAsJsonAsync($"/api/trips/{id}", Trip("Venice"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.PostAsJsonAsync($"/api/trips/{id}/budget/expenses", Expense())).StatusCode);
        var sharing = await Json(await owner.GetAsync($"/api/trips/{id}/sharing"));
        var memberId = sharing.GetProperty("members")[0].GetProperty("userId").GetString();
        (await owner.PutAsJsonAsync($"/api/trips/{id}/sharing/members/{memberId}", new { role = "Editor" })).EnsureSuccessStatusCode();
        (await member.PutAsJsonAsync($"/api/trips/{id}", Trip("Venice"))).EnsureSuccessStatusCode();
        (await member.PostAsJsonAsync($"/api/trips/{id}/budget/expenses", Expense())).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await member.DeleteAsync($"/api/trips/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.PostAsJsonAsync($"/api/trips/{id}/sharing/invitations", new { email = "stranger@example.test", role = "Editor" })).StatusCode);
        (await owner.DeleteAsync($"/api/trips/{id}/sharing/members/{memberId}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"/api/trips/{id}/budget")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.PutAsJsonAsync($"/api/trips/{id}", Trip())).StatusCode);
        Assert.Empty((await Json(await member.GetAsync("/api/trips"))).EnumerateArray());
        Assert.Equal(12.50m, (await Budget(owner, id)).GetProperty("totalSpent").GetDecimal());
    }

    [Fact]
    public async Task Duplicate_invites_update_role_and_declined_or_cancelled_invites_cannot_be_accepted()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        using var member = await User(app, "member");
        var id = await Create(owner);
        var invitation = await Invite(owner, id, "member", "Viewer");
        var result = await Json(await owner.PostAsJsonAsync($"/api/trips/{id}/sharing/invitations", new { email = "MEMBER@example.test", role = "Editor" }));
        var pending = Assert.Single(result.GetProperty("invitations").EnumerateArray());
        Assert.Equal(invitation, pending.GetProperty("id").GetInt32());
        Assert.Equal("Editor", pending.GetProperty("role").GetString());
        Assert.Single((await Json(await member.GetAsync("/api/sharing/invitations"))).EnumerateArray());
        (await member.PostAsync($"/api/sharing/invitations/{invitation}/decline", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await member.PostAsync($"/api/sharing/invitations/{invitation}/accept", null)).StatusCode);
        invitation = await Invite(owner, id, "member", "Viewer");
        (await owner.DeleteAsync($"/api/trips/{id}/sharing/invitations/{invitation}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await member.PostAsync($"/api/sharing/invitations/{invitation}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/trips/{id}/sharing/invitations", new { email = "member@example.test", role = "Owner" })).StatusCode);
    }

    [Fact]
    public async Task Expense_create_edit_delete_recalculates_totals_and_rejects_cross_trip_ids()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        var id = await Create(owner);
        var other = await Create(owner);
        (await owner.PutAsJsonAsync($"/api/trips/{id}/budget", new { amount = 100, currency = "EUR" })).EnsureSuccessStatusCode();
        var added = await Json(await owner.PostAsJsonAsync($"/api/trips/{id}/budget/expenses", Expense()));
        var expense = Assert.Single(added.GetProperty("expenses").EnumerateArray());
        var expenseId = expense.GetProperty("id").GetInt32();
        Assert.Equal("Museum tickets", expense.GetProperty("description").GetString());
        Assert.Equal(12.50m, added.GetProperty("totalSpent").GetDecimal());
        Assert.Equal(87.50m, added.GetProperty("remaining").GetDecimal());
        Assert.Equal(12.5m, added.GetProperty("percentUsed").GetDecimal());
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/trips/{other}/budget/expenses/{expenseId}", Expense(99))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.DeleteAsync($"/api/trips/{other}/budget/expenses/{expenseId}")).StatusCode);
        (await owner.PutAsJsonAsync($"/api/trips/{id}/budget/expenses/{expenseId}", Expense(125.75m))).EnsureSuccessStatusCode();
        var edited = await Budget(owner, id);
        Assert.Equal(125.75m, edited.GetProperty("totalSpent").GetDecimal());
        Assert.Equal(-25.75m, edited.GetProperty("remaining").GetDecimal());
        Assert.Equal("EUR", edited.GetProperty("currency").GetString());
        (await owner.DeleteAsync($"/api/trips/{id}/budget/expenses/{expenseId}")).EnsureSuccessStatusCode();
        var cleared = await Budget(owner, id);
        Assert.Equal(0m, cleared.GetProperty("totalSpent").GetDecimal());
        Assert.Empty(cleared.GetProperty("expenses").EnumerateArray());
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    public async Task Invalid_expenses_leave_totals_unchanged(int amount)
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        var id = await Create(owner);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/trips/{id}/budget/expenses", Expense(amount))).StatusCode);
        Assert.Empty((await Budget(owner, id)).GetProperty("expenses").EnumerateArray());
    }

    [Fact]
    public async Task Unrelated_accounts_cannot_read_or_mutate_trip_data()
    {
        using var app = new ResetApplication();
        using var owner = await User(app, "owner");
        using var stranger = await User(app, "stranger");
        using var anonymous = app.CreateClient();
        var id = await Create(owner);
        foreach (var suffix in new[] { "", "/itinerary", "/packing", "/budget", "/sharing" })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/trips/{id}{suffix}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/trips/{id}{suffix}")).StatusCode);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsJsonAsync($"/api/trips/{id}", Trip("Stolen"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/trips/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync($"/api/trips/{id}/budget/expenses", Expense())).StatusCode);
        Assert.Equal("Rome", (await Json(await owner.GetAsync($"/api/trips/{id}"))).GetProperty("destination").GetString());
    }
}
