using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;
using server.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.ConfigureProductionHosting();
builder.Services.AddSingleton<WorkerHealth>();
builder.Services.AddPasswordResetRateLimiting();
builder.Services.AddScoped<PasswordResetQueue>();
builder.Services.AddHostedService<PasswordResetWorker>();
builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddDbContext<TripPlannerContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("TripPlanner")));
builder.Services.AddAuthorization();
builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);
builder.Services.AddScoped<TripAccessService>();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<NotificationService>();
builder.Services.AddHostedService<NotificationWorker>();
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Email:Smtp"));
builder.Services.AddTransient<SmtpEmailTransport>();
builder.Services.AddTransient<IPasswordResetEmailSender, PasswordResetEmailSender>();
builder.Services.AddTransient<IReminderEmailSender, ReminderEmailSender>();
builder.Services.AddScoped<ReminderEmailDelivery>();
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
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    });

var app = builder.Build();
_ = app.Services.GetRequiredService<HostingSettings>();

// A missing peer address cannot establish proxy trust (for example, a custom transport).
app.UseWhen(context => context.Connection.RemoteIpAddress is not null, branch => branch.UseForwardedHeaders());
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseWhen(context => !context.Request.Path.StartsWithSegments("/health") && !context.Request.Path.StartsWithSegments("/ops"), branch => branch.UseHttpsRedirection());
    app.UseExceptionHandler(handler => handler.Run(async context =>
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new { detail = "An unexpected error occurred. Please try again." });
    }));
}
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.Use(async (context, next) =>
{
    // Identity bearer tickets may outlive account deletion; reject them as well as stale cookies.
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var db = context.RequestServices.GetRequiredService<TripPlannerContext>();
        if (userId is null || !await db.Users.AnyAsync(u => u.Id == userId, context.RequestAborted))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }
    }
    await next();
});
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

app.MapOperations();
app.MapControllers();
var identityEndpoints = app.MapGroup("/api/auth");
identityEndpoints.AddEndpointFilter(async (context, next) =>
{
    // Keep the framework alias on the same durable delivery/cooldown path.
    if (string.Equals(context.HttpContext.Request.Path.Value?.TrimEnd('/'), "/api/auth/forgotPassword", StringComparison.OrdinalIgnoreCase))
        return Results.Redirect("/api/auth/forgot-password", preserveMethod: true);
    return await next(context);
});
identityEndpoints.MapIdentityApi<IdentityUser>();
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
    PasswordResetQueue queue,
    IHostEnvironment environment,
    IPasswordResetEmailSender emailSender,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 320 || !new EmailAddressAttribute().IsValid(request.Email))
        return Results.BadRequest(new { detail = "Enter a valid email address." });

    // Check before looking up the account, so configuration failures don't reveal registered emails.
    if (!environment.IsDevelopment() && !emailSender.IsConfigured)
    {
        logger.LogError("Password reset email delivery is not configured.");
        return Results.Problem(statusCode: 503, detail: "Password reset is temporarily unavailable. Please try again later.");
    }

    const string message = "If an account exists for that email, you will receive a reset code.";
    string? token;
    try
    {
        token = await queue.EnqueueAsync(request.Email, cancellationToken);
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
    catch (Exception exception)
    {
        logger.LogError("Password reset queue unavailable ({FailureType}).", exception.GetType().Name);
        return Results.Problem(statusCode: 503, detail: "Password reset is temporarily unavailable. Please try again later.");
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

// API misses must remain 404; only browser routes receive the React entry point.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");
app.Run();

record ForgotPasswordRequest(string Email);
record ResetPasswordRequest(string Email, string ResetToken, string NewPassword);

public partial class Program { }
