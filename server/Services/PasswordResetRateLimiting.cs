using System.Globalization;
using System.Threading.RateLimiting;

namespace server.Services;

public static class PasswordResetRateLimiting
{
    public static IServiceCollection AddPasswordResetRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            // Include the Identity API aliases, so an alternative route cannot bypass the limits.
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                PartitionedRateLimiter.Create<HttpContext, string>(context => IsRecovery(context)
                    ? RateLimitPartition.GetFixedWindowLimiter("recovery-global", _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 100, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                    })
                    : RateLimitPartition.GetNoLimiter("other")),
                PartitionedRateLimiter.Create<HttpContext, string>(context => IsRecovery(context)
                    ? RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10, Window = TimeSpan.FromMinutes(15), QueueLimit = 0
                    })
                    : RateLimitPartition.GetNoLimiter("other")));
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                    ? Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)) : 900;
                context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
                await context.HttpContext.Response.WriteAsJsonAsync(new { detail = "Too many password reset requests. Please try again later." }, cancellationToken);
            };
        });
        return services;
    }

    private static bool IsRecovery(HttpContext context) => HttpMethods.IsPost(context.Request.Method)
        && context.Request.Path.Value?.TrimEnd('/').ToLowerInvariant() is
            "/api/auth/forgot-password" or "/api/auth/reset-password" or "/api/auth/forgotpassword" or "/api/auth/resetpassword";
}
