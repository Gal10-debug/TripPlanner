using System.ComponentModel.DataAnnotations;
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
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Email:Smtp"));
builder.Services.AddTransient<IPasswordResetEmailSender, PasswordResetEmailSender>();
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
    options.TokenLifespan = TimeSpan.FromHours(1));
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
    IHostEnvironment environment,
    IPasswordResetEmailSender emailSender,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || !new EmailAddressAttribute().IsValid(request.Email))
        return Results.BadRequest(new { detail = "Enter a valid email address." });

    // Check before looking up the account, so configuration failures don't reveal registered emails.
    if (!environment.IsDevelopment() && !emailSender.IsConfigured)
    {
        logger.LogError("Password reset email delivery is not configured.");
        return Results.Problem(statusCode: 503, detail: "Password reset is temporarily unavailable. Please try again later.");
    }

    const string message = "If an account exists for that email, you will receive a reset code.";
    var user = await userManager.FindByEmailAsync(request.Email.Trim());

    if (user is null)
    {
        return Results.Ok(new { message, resetToken = (string?)null });
    }

    var token = await userManager.GeneratePasswordResetTokenAsync(user);

    if (emailSender.IsConfigured)
    {
        try
        {
            await emailSender.SendAsync(user.Email!, token, cancellationToken);
        }
        catch (Exception exception)
        {
            // Do not log tokens, recipient addresses, credentials, or SMTP response bodies.
            logger.LogError("Password reset email delivery failed ({FailureType}).", exception.GetType().Name);
            // Keep the response identical for known and unknown accounts.
        }
    }

    // Preserve the local development shortcut; never expose a token in production.
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
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.ResetToken)
        || string.IsNullOrWhiteSpace(request.NewPassword))
        return Results.BadRequest(new { detail = "Email, reset code, and new password are required." });

    var user = await userManager.FindByEmailAsync(request.Email.Trim());
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

public partial class Program { }
