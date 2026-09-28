using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using server.Services;

namespace server.Tests;

public class PasswordResetRateLimitingTests
{
    [Fact]
    public async Task Global_recovery_limit_caps_requests_across_different_IP_addresses()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddPasswordResetRateLimiting();
        using var provider = services.BuildServiceProvider();
        using var limiter = provider.GetRequiredService<IOptions<RateLimiterOptions>>().Value.GlobalLimiter!;
        for (var i = 1; i <= 101; i++)
        {
            var context = new DefaultHttpContext();
            context.Request.Method = "POST";
            context.Request.Path = "/api/auth/forgot-password";
            context.Connection.RemoteIpAddress = IPAddress.Parse($"192.0.2.{i}");
            using var lease = await limiter.AcquireAsync(context);
            Assert.Equal(i <= 100, lease.IsAcquired);
        }
        var unrelated = new DefaultHttpContext();
        unrelated.Request.Path = "/api/trips";
        using var unrestricted = await limiter.AcquireAsync(unrelated);
        Assert.True(unrestricted.IsAcquired);
    }
}
