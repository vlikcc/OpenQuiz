using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The countdown used to live entirely in the browser, so anyone who paused
/// their own timer — or just kept the tab open — could answer a question long
/// after the room had moved on.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class QuestionTimerTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Putting_a_question_on_screen_starts_its_clock()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var created = await CreatePollAsync(owner);

        var live = await ActivateAsync(owner, created.Id);
        Assert.NotNull(live.QuestionStartedAt);

        var advanced = await ReadAsync<PollDto>(
            await owner.PostAsync($"/api/polls/{created.Id}/next-question", null));

        Assert.NotNull(advanced.QuestionStartedAt);
        Assert.True(advanced.QuestionStartedAt > live.QuestionStartedAt);
    }

    [Fact]
    public async Task Ending_the_poll_stops_the_clock()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var created = await CreatePollAsync(owner);
        await ActivateAsync(owner, created.Id);

        var ended = await ReadAsync<PollDto>(await owner.PostAsync($"/api/polls/{created.Id}/end", null));

        Assert.Null(ended.QuestionStartedAt);
    }

    [Fact]
    public async Task Going_back_to_a_question_gives_it_a_fresh_clock()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var created = await CreatePollAsync(owner);
        await ActivateAsync(owner, created.Id);
        await owner.PostAsync($"/api/polls/{created.Id}/next-question", null);

        await BackdateAsync(created.Id, TimeSpan.FromMinutes(5));
        var back = await ReadAsync<PollDto>(await owner.PostAsync($"/api/polls/{created.Id}/prev-question", null));

        Assert.NotNull(back.QuestionStartedAt);
        Assert.Equal(HttpStatusCode.OK, (await VoteAsync(created.Id, 0, "Ada")).StatusCode);
    }

    [Fact]
    public async Task A_vote_after_the_time_limit_is_refused()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, TimedQuiz(seconds: 20));
        await ActivateAsync(owner, poll.Id);

        Assert.Equal(HttpStatusCode.OK, (await VoteAsync(poll.Id, 0, "Ada")).StatusCode);

        await BackdateAsync(poll.Id, TimeSpan.FromSeconds(25));

        var late = await VoteAsync(poll.Id, 0, "Grace");
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Contains("Time is up", await late.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// A phone on venue Wi-Fi is easily a second behind, and punishing that would
    /// make the last second of every question a lottery.
    /// </summary>
    [Fact]
    public async Task An_answer_that_lands_just_past_the_buzzer_still_counts()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, TimedQuiz(seconds: 20));
        await ActivateAsync(owner, poll.Id);

        await BackdateAsync(poll.Id, TimeSpan.FromSeconds(21));

        Assert.Equal(HttpStatusCode.OK, (await VoteAsync(poll.Id, 0, "Ada")).StatusCode);
    }

    [Fact]
    public async Task An_open_answer_after_the_time_limit_is_refused()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, TimedOpenEnded(seconds: 15));
        await ActivateAsync(owner, poll.Id);

        await BackdateAsync(poll.Id, TimeSpan.FromSeconds(30));

        var late = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/open-answers",
            new SubmitOpenAnswerRequest(0, "Kept typing", "Ada"));

        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
    }

    [Fact]
    public async Task A_word_cloud_submission_after_the_time_limit_is_refused()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, TimedWordCloud(seconds: 15));
        await ActivateAsync(owner, poll.Id);

        await BackdateAsync(poll.Id, TimeSpan.FromSeconds(30));

        var late = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/wordcloud/submit",
            new WordCloudSubmitRequest(0, ["geç"], "Ada"));

        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
    }

    /// <summary>
    /// Response time breaks ties on the leaderboard, so it is worth forging. The
    /// server measures it instead of believing the number in the request.
    /// </summary>
    [Fact]
    public async Task The_recorded_response_time_comes_from_the_server_not_the_client()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, TimedQuiz(seconds: 60));
        await ActivateAsync(owner, poll.Id);

        await BackdateAsync(poll.Id, TimeSpan.FromSeconds(10));

        var claimed = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/votes",
            new SubmitVoteRequest(0, [1], ResponseTimeMs: 1, "Ada"));
        claimed.EnsureSuccessStatusCode();

        await using var db = CreateDbContext();
        var vote = await db.Votes.SingleAsync(v => v.PollId == poll.Id);

        Assert.True(vote.ResponseTimeMs >= 10_000, $"recorded {vote.ResponseTimeMs} ms");
    }

    [Fact]
    public async Task The_snapshot_carries_the_server_clock_so_a_late_joiner_can_align()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var created = await CreatePollAsync(owner);
        await ActivateAsync(owner, created.Id);

        var seen = await ReadAsync<PollDto>(await Anonymous.GetAsync($"/api/polls/{created.Id}"));

        Assert.Equal(DateTimeKind.Utc, seen.ServerTime.Kind);
        Assert.Equal(DateTimeKind.Utc, seen.QuestionStartedAt!.Value.Kind);
        Assert.True((DateTime.UtcNow - seen.ServerTime).Duration() < TimeSpan.FromMinutes(1));
    }

    /// <summary>
    /// Moves the question's start into the past, which is the only way to reach
    /// an expired timer without making the test wait for one.
    /// </summary>
    private async Task BackdateAsync(Guid pollId, TimeSpan by)
    {
        await using var db = CreateDbContext();
        await db.Polls
            .Where(p => p.Id == pollId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.QuestionStartedAt, DateTime.UtcNow - by));
    }

    private Task<HttpResponseMessage> VoteAsync(Guid pollId, int questionIndex, string voter) =>
        PostAsync(Anonymous, $"/api/polls/{pollId}/votes",
            new SubmitVoteRequest(questionIndex, [1], 800, voter));

    private static CreatePollRequest TimedQuiz(int seconds) => new(
        "Timed quiz",
        PollType.Quiz,
        [
            Question(seconds, QuestionType.MultipleChoice, [new OptionInput(0, "No"), new OptionInput(1, "Yes")]),
            Question(seconds, QuestionType.MultipleChoice, [new OptionInput(0, "No"), new OptionInput(1, "Yes")], order: 1),
        ]);

    private static CreatePollRequest TimedOpenEnded(int seconds) => new(
        "Timed retro", PollType.Survey, [Question(seconds, QuestionType.Open, [])]);

    private static CreatePollRequest TimedWordCloud(int seconds) => new(
        "Timed cloud", PollType.WordCloud, [Question(seconds, QuestionType.WordCloud, [])]);

    private static QuestionInput Question(
        int seconds, QuestionType type, List<OptionInput> options, int order = 0) => new(
        OrderIndex: order,
        Text: "How is it going?",
        ImageUrl: null,
        TimeLimit: seconds,
        QuestionType: type,
        AllowMultiple: false,
        CorrectOptionIndex: type == QuestionType.MultipleChoice ? 1 : null,
        CorrectAnswer: null,
        Points: 10,
        MaxWords: type == QuestionType.WordCloud ? 3 : null,
        WordCloudConfig: null,
        Options: options);
}
