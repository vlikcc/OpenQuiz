using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Reports;
using OpenQuiz.Application.Votes;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Export is a paid feature. The gate has to fire after the ownership check:
/// a stranger probing someone else's poll must get 403, not a 402 that would
/// leak which plan the owner is on.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ReportExportGateTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
    };

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task A_free_plan_owner_cannot_export_the_report()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));
        var poll = await CreatePollAsync(owner);

        var response = await owner.GetAsync($"/api/polls/{poll.Id}/report");

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PlanErrorBody>(Json);
        Assert.Equal("plan_feature_required", body!.Title);
        Assert.Equal("reports.export", body.FeatureKey);
    }

    [Fact]
    public async Task A_pro_plan_owner_gets_the_full_report()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("pro"));
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        (await PostAsync(Anonymous, $"/api/polls/{poll.Id}/votes",
            new SubmitVoteRequest(0, [1], 500, "Ada"))).EnsureSuccessStatusCode();

        var response = await owner.GetAsync($"/api/polls/{poll.Id}/report");
        response.EnsureSuccessStatusCode();

        var report = await ReadAsync<PollReportDto>(response);
        Assert.Equal(poll.Id, report.PollId);
        Assert.Equal(poll.Title, report.Title);
        Assert.Contains(report.Votes, v => v.UserName == "Ada");
        Assert.Contains(report.Scores, s => s.UserName == "Ada");
        Assert.NotEmpty(report.Aggregates);
    }

    [Fact]
    public async Task A_stranger_gets_forbidden_not_a_plan_error()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("pro"));
        var poll = await CreatePollAsync(owner);

        using var stranger = ClientFor(await RegisterOnPlanAsync("free"));
        var response = await stranger.GetAsync($"/api/polls/{poll.Id}/report");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task An_anonymous_caller_is_unauthorized()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("pro"));
        var poll = await CreatePollAsync(owner);

        var response = await Anonymous.GetAsync($"/api/polls/{poll.Id}/report");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private record PlanErrorBody(string Title, string? FeatureKey);
}
