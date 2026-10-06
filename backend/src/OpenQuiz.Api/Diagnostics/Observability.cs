using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace OpenQuiz.Api.Diagnostics;

public class ObservabilityOptions
{
    public const string SectionName = "Observability";

    public string ServiceName { get; set; } = "openquiz-api";

    /// <summary>
    /// Exposes an unauthenticated Prometheus scrape endpoint. Request paths and
    /// status codes are not secrets, but they are not public either, so this is
    /// off unless the operator opens it and keeps the port private.
    /// </summary>
    public bool PrometheusEnabled { get; set; }

    public string PrometheusPath { get; set; } = "/metrics";

    /// <summary>OTLP collector, e.g. <c>http://otel-collector:4317</c>. Blank disables export.</summary>
    public string? OtlpEndpoint { get; set; }

    public bool UsesOtlp => !string.IsNullOrWhiteSpace(OtlpEndpoint);

    public bool IsEnabled => PrometheusEnabled || UsesOtlp;
}

public static class ObservabilityExtensions
{
    /// <summary>
    /// Wires request, HTTP client and runtime instrumentation when the operator
    /// has somewhere to send it. Collecting metrics nobody reads only costs
    /// memory, so nothing is registered until an exporter is configured.
    /// </summary>
    public static IServiceCollection AddOpenQuizObservability(
        this IServiceCollection services, ObservabilityOptions options)
    {
        if (!options.IsEnabled) return services;

        services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(options.ServiceName))
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddMeter("Microsoft.AspNetCore.Hosting", "Microsoft.AspNetCore.Server.Kestrel");

                if (options.PrometheusEnabled) metrics.AddPrometheusExporter();
                if (options.UsesOtlp) metrics.AddOtlpExporter(o => o.Endpoint = new Uri(options.OtlpEndpoint!));
            })
            .WithTracing(tracing =>
            {
                if (!options.UsesOtlp) return;

                tracing
                    .AddAspNetCoreInstrumentation()
                    .AddOtlpExporter(o => o.Endpoint = new Uri(options.OtlpEndpoint!));
            });

        return services;
    }

    public static void MapOpenQuizMetrics(this WebApplication app, ObservabilityOptions options)
    {
        if (options.PrometheusEnabled) app.MapPrometheusScrapingEndpoint(options.PrometheusPath);
    }
}
