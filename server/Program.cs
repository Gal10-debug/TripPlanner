using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddDbContext<TripPlannerContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("TripPlanner")));
builder.Services.AddAuthorization();
builder.Services.AddScoped<TripAccessService>();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddHttpClient<WeatherService>(client => client.Timeout = TimeSpan.FromSeconds(8));
builder.Services.AddIdentityApiEndpoints<IdentityUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
    })
    .AddEntityFrameworkStores<TripPlannerContext>();
builder.Services.Configure<CookieAuthenticationOptions>(
    IdentityConstants.ApplicationScheme,
    options =>
    {
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});


var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var database = scope.ServiceProvider.GetRequiredService<TripPlannerContext>();
    database.Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();
app.MapGroup("/api/auth").MapIdentityApi<IdentityUser>();
app.MapPost("/api/auth/logout", async (SignInManager<IdentityUser> signInManager) =>
    {
        await signInManager.SignOutAsync();
        return Results.NoContent();
    })
    .RequireAuthorization();
app.MapGet("/api/auth/me", (HttpContext context) =>
    Results.Ok(new { email = context.User.Identity?.Name }))
    .RequireAuthorization();

app.MapPost("/api/auth/forgot-password", async (
    ForgotPasswordRequest request,
    UserManager<IdentityUser> userManager,
    IHostEnvironment environment) =>
{
    const string message = "If an account exists for that email, password reset instructions have been created.";
    var user = await userManager.FindByEmailAsync(request.Email);

    if (user is null)
    {
        return Results.Ok(new { message, resetToken = (string?)null });
    }

    var token = await userManager.GeneratePasswordResetTokenAsync(user);

    // Until an email provider is configured, expose the token only when running locally.
    return Results.Ok(new
    {
        message,
        resetToken = environment.IsDevelopment() ? token : null
    });
});

app.MapPost("/api/auth/reset-password", async (
    ResetPasswordRequest request,
    UserManager<IdentityUser> userManager) =>
{
    var user = await userManager.FindByEmailAsync(request.Email);
    if (user is null)
    {
        return Results.BadRequest(new { detail = "The reset code is invalid or has expired." });
    }

    var result = await userManager.ResetPasswordAsync(user, request.ResetToken, request.NewPassword);
    if (!result.Succeeded)
    {
        var errors = result.Errors
            .GroupBy(error => error.Code)
            .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray());
        return Results.ValidationProblem(errors);
    }

    return Results.NoContent();
});

app.Run();

record ForgotPasswordRequest(string Email);
record ResetPasswordRequest(string Email, string ResetToken, string NewPassword);
