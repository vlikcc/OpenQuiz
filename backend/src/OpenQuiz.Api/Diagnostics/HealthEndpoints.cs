using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Api.Diagnostics;

public static class HealthEndpoints
{
    /// <summary>Answers "is the process alive", never touching a dependency.</summary>
    public const string Live = "live";

    /// <summary>Answers "can this instance serve traffic", which means the database.</summary>
    public const string Ready = "ready";

    public static IServiceCollection AddOpenQuizHealthChecks(this IServiceCollection services) =>
        services.AddHealthChecks()
            .AddCheck("process", () => HealthCheckResult.Healthy(), tags: [Live])
            .AddDbContextCheck<OpenQuizDbContext>("database", tags: [Ready])
            .Services;

    public static void MapOpenQuizHealthChecks(this WebApplication app)
    {
        // Liveness must not depend on the database: a restart loop triggered by
        // an unreachable database takes the API down instead of letting it wait.
        app.MapHealthChecks("/health/live", Options(check => check.Tags.Contains(Live)));
        app.MapHealthChecks("/health/ready", Options(check => check.Tags.Contains(Ready)));

        // Kept for existing probes and documentation, and equivalent to readiness.
        app.MapHealthChecks("/health", Options(_ => true));
    }

    private static HealthCheckOptions Options(Func<HealthCheckRegistration, bool> predicate) => new()
    {
        Predicate = predicate,
        ResponseWriter = WriteAsync,
    };

    private static Task WriteAsync(HttpContext ctx, HealthReport report)
    {
        ctx.Response.ContentType = "application/json";

        return ctx.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            durationMs = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                durationMs = e.Value.Duration.TotalMilliseconds,
                // The exception message can name the host and credentials, so it
                // stays in the log rather than the response body.
                error = e.Value.Exception is null ? null : "see server logs",
            }),
        }));
    }
}
