using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OpenQuiz.Application.Abstractions;

namespace OpenQuiz.Api.Tests.Infrastructure;

/// <summary>
/// Boots the real API against the fixture's database, with only the pieces that
/// reach outside the process (SMTP, Google, the SignalR fan-out) swapped out.
/// </summary>
public sealed class OpenQuizApiFactory : WebApplicationFactory<Program>
{
    // 64 bytes, comfortably past the 32-byte floor Program.cs enforces outside
    // Development.
    private const string SigningKey = "test-signing-key-must-be-at-least-32-bytes-long-for-hmac-sha256!";

    private readonly Dictionary<string, string?> _settings;

    public OpenQuizApiFactory(string connectionString, IDictionary<string, string?>? overrides = null)
    {
        _settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = connectionString,
            ["Jwt:SigningKey"] = SigningKey,
            ["Jwt:Issuer"] = "openquiz-tests",
            ["Jwt:Audience"] = "openquiz-tests",
            // The fixture migrates once; letting every host do it again would
            // serialise the suite behind redundant schema checks.
            ["App:AutoMigrate"] = "false",
            ["App:PublicUrl"] = "https://openquiz.test",
            ["Media:RootPath"] = Path.Combine(Path.GetTempPath(), "openquiz-tests-media", Guid.NewGuid().ToString("N")),
            // Off unless a test opts in, so unrelated tests cannot exhaust the
            // window for each other.
            ["RateLimiting:Enabled"] = "false",
        };

        if (overrides is not null)
        {
            foreach (var (key, value) in overrides) _settings[key] = value;
        }
    }

    public CapturingEmailSender Emails { get; } = new();

    public RecordingRealtimeNotifier Realtime { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        foreach (var (key, value) in _settings) builder.UseSetting(key, value);

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);

            services.RemoveAll<IRealtimeNotifier>();
            services.AddSingleton<IRealtimeNotifier>(Realtime);

            // Webhook tests post at /api/billing/webhooks/test. Production
            // never registers this key — the host under test is the exception.
            services.AddSingleton<IPaymentProvider, TestPaymentProvider>();
        });
    }
}
