using System.Net;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.AspNetCore.HttpOverrides;

namespace server.Infrastructure;

public sealed record HostingSettings(string[] Origins, string? KeyPath, string[] Proxies)
{
    public static HostingSettings Read(IConfiguration configuration, IHostEnvironment environment)
    {
        var development = environment.IsDevelopment();
        var origin = configuration["Hosting:PublicOrigin"];
        var keyPath = configuration["Hosting:DataProtectionPath"];
        if (!development && (string.IsNullOrWhiteSpace(origin) || string.IsNullOrWhiteSpace(keyPath)))
            throw new InvalidOperationException("Production requires Hosting:PublicOrigin and Hosting:DataProtectionPath.");
        var origins = (configuration.GetSection("Hosting:AllowedOrigins").Get<string[]>() ?? [])
            .Concat(origin is null ? (development ? ["http://localhost:5173"] : []) : new[] { origin }).Select(o => o.TrimEnd('/')).Distinct().ToArray();
        foreach (var allowed in origins)
            if (!Uri.TryCreate(allowed, UriKind.Absolute, out var uri) || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query)
                || !string.IsNullOrEmpty(uri.Fragment) || !string.IsNullOrEmpty(uri.UserInfo) || (!development && uri.Scheme != "https"))
                throw new InvalidOperationException("Allowed origins must be absolute HTTPS origins without paths in production.");
        var proxies = configuration.GetSection("Hosting:TrustedProxies").Get<string[]>() ?? ["127.0.0.1", "::1"];
        if (proxies.Length == 0 || proxies.Any(p => !IPAddress.TryParse(p, out _)))
            throw new InvalidOperationException("TrustedProxies must contain explicit valid proxy IP addresses.");
        return new(origins, keyPath, proxies);
    }
}

public static class ProductionHosting
{
    public static void ConfigureProductionHosting(this WebApplicationBuilder builder)
    {
        // Read final configuration at resolution time, including test/host overrides.
        builder.Services.AddSingleton(sp => HostingSettings.Read(sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IHostEnvironment>()));
        builder.Services.AddCors();
        builder.Services.AddOptions<CorsOptions>().Configure<HostingSettings>((options, settings) =>
            options.AddDefaultPolicy(policy => policy.WithOrigins(settings.Origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
        builder.Services.AddDataProtection().SetApplicationName("TripPlanner");
        builder.Services.AddOptions<KeyManagementOptions>().Configure<HostingSettings, ILoggerFactory>((options, settings, logs) =>
        {
            if (!string.IsNullOrWhiteSpace(settings.KeyPath))
                options.XmlRepository = new FileSystemXmlRepository(new DirectoryInfo(settings.KeyPath), logs);
        });
        builder.Services.AddOptions<ForwardedHeadersOptions>().Configure<HostingSettings>((options, settings) =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            options.KnownProxies.Clear();
            options.KnownIPNetworks.Clear();
            foreach (var proxy in settings.Proxies) options.KnownProxies.Add(IPAddress.Parse(proxy));
        });
        builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);
        builder.Services.AddHsts(options => { options.MaxAge = TimeSpan.FromDays(180); options.IncludeSubDomains = false; });
    }
}
