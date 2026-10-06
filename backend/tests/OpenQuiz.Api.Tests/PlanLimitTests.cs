using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The free plan's numeric caps and feature gates, enforced from
/// <c>PollService</c>. Every rejection must be a 402 with the
/// <c>plan_limit_exceeded</c>/<c>plan_feature_required</c> discriminator in
/// the ProblemDetails body — not a bare 400/403 the frontend cannot act on.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class PlanLimitTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
    };

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Exceeding_the_free_plans_question_cap_is_rejected_with_the_limit_key()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        // The free plan's questions-per-poll cap is 15 (see PlanCatalog).
        var response = await owner.PostAsJsonAsync("/api/polls", ManyQuestionPoll(16));

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PlanErrorBody>(Json);
        Assert.Equal("plan_limit_exceeded", body!.Title);
        Assert.Equal("limits.questionsPerPoll", body.LimitKey);
    }

    [Fact]
    public async Task A_poll_within_the_question_cap_is_created_normally()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        var response = await owner.PostAsJsonAsync("/api/polls", ManyQuestionPoll(15));

        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task WordCloud_is_a_paid_feature_the_free_plan_does_not_include()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        var response = await owner.PostAsJsonAsync("/api/polls", WordCloudPoll());

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PlanErrorBody>(Json);
        Assert.Equal("plan_feature_required", body!.Title);
        Assert.Equal("content.wordcloud", body.FeatureKey);
    }

    [Fact]
    public async Task A_second_simultaneously_active_poll_exceeds_the_free_plans_active_poll_cap()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        var first = await CreatePollAsync(owner);
        await ActivateAsync(owner, first.Id);

        var second = await CreatePollAsync(owner);
        var response = await owner.PostAsync($"/api/polls/{second.Id}/activate", null);

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PlanErrorBody>(Json);
        Assert.Equal("plan_limit_exceeded", body!.Title);
        Assert.Equal("limits.activePolls", body.LimitKey);
    }

    [Fact]
    public async Task Ending_a_poll_frees_up_the_active_poll_cap_for_the_next_one()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        var first = await CreatePollAsync(owner);
        await ActivateAsync(owner, first.Id);
        (await owner.PostAsync($"/api/polls/{first.Id}/end", null)).EnsureSuccessStatusCode();

        var second = await CreatePollAsync(owner);
        var response = await owner.PostAsync($"/api/polls/{second.Id}/activate", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// Re-activating an already-live poll (a double-clicked button, a stale
    /// tab) must not count a second session against the monthly cap or trip
    /// the active-poll cap against itself.
    /// </summary>
    [Fact]
    public async Task Re_activating_an_already_live_poll_does_not_double_count()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);
        var again = await owner.PostAsync($"/api/polls/{poll.Id}/activate", null);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    private static CreatePollRequest ManyQuestionPoll(int count) => new(
        "Large quiz",
        PollType.Quiz,
        Enumerable.Range(0, count).Select(i => new QuestionInput(
            OrderIndex: i,
            Text: $"Question {i}",
            ImageUrl: null,
            TimeLimit: 30,
            QuestionType: QuestionType.MultipleChoice,
            AllowMultiple: false,
            CorrectOptionIndex: 0,
            CorrectAnswer: null,
            Points: 10,
            MaxWords: null,
            WordCloudConfig: null,
            Options: [new OptionInput(0, "A"), new OptionInput(1, "B")]
        )).ToList());

    private static CreatePollRequest WordCloudPoll() => new(
        "Which tools do you use?",
        PollType.WordCloud,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "Name a tool",
                ImageUrl: null,
                TimeLimit: 60,
                QuestionType: QuestionType.WordCloud,
                AllowMultiple: false,
                CorrectOptionIndex: null,
                CorrectAnswer: null,
                Points: 10,
                MaxWords: 5,
                WordCloudConfig: null,
                Options: []),
        ]);

    private record PlanErrorBody(string Title, string? LimitKey, string? FeatureKey);
}
