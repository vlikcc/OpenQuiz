using System.Net;
using System.Text.Json;
using OpenQuiz.Api.Tests.Infrastructure;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Probes decide whether an instance is restarted or sent traffic, so the two
/// questions they ask have to stay separate: a database outage must not look
/// like a dead process.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class DiagnosticsTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Readiness_passes_when_the_database_answers()
    {
        var response = await Anonymous.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("database", await CheckNamesAsync(response));
    }

    [Fact]
    public async Task Liveness_does_not_touch_the_database()
    {
        var response = await Anonymous.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("database", await CheckNamesAsync(response));
    }

    [Fact]
    public async Task An_unreachable_database_fails_readiness_but_keeps_the_process_alive()
    {
        await using var broken = new OpenQuizApiFactory(
            "Host=127.0.0.1;Port=1;Database=openquiz;Username=openquiz;Password=nobody;Timeout=1");
        using var client = broken.CreateClient();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
    }

    /// <summary>
    /// The connection string and server name travel in the exception, and the
    /// probe endpoint is normally the one thing left open to the network.
    /// </summary>
    [Fact]
    public async Task A_failing_check_does_not_leak_the_reason_to_the_caller()
    {
        await using var broken = new OpenQuizApiFactory(
            "Host=127.0.0.1;Port=1;Database=openquiz;Username=openquiz;Password=hunter2;Timeout=1");
        using var client = broken.CreateClient();

        var body = await (await client.GetAsync("/health/ready")).Content.ReadAsStringAsync();

        Assert.DoesNotContain("hunter2", body);
        Assert.DoesNotContain("127.0.0.1", body);
    }

    [Fact]
    public async Task Metrics_stay_closed_unless_the_operator_opens_them()
    {
        var response = await Anonymous.GetAsync("/metrics");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task An_opened_scrape_endpoint_reports_request_counts()
    {
        await using var observed = new OpenQuizApiFactory(
            ConnectionString,
            new Dictionary<string, string?> { ["Observability:PrometheusEnabled"] = "true" });
        using var client = observed.CreateClient();

        // Something has to be measured before the exporter has anything to say.
        await client.GetAsync("/health/live");

        var body = await (await client.GetAsync("/metrics")).Content.ReadAsStringAsync();

        Assert.Contains("http_server_request_duration_seconds", body);
    }

    private static async Task<IReadOnlyList<string>> CheckNamesAsync(HttpResponseMessage response)
    {
        using var report = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        return report.RootElement.GetProperty("checks")
            .EnumerateArray()
            .Select(check => check.GetProperty("name").GetString()!)
            .ToList();
    }
}
