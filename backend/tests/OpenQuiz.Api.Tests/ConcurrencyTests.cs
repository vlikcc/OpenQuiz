using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// A live room does everything at once: the audience joins in a burst, everyone
/// answers on the same beat, and the presenter clicks ahead. Each counter below
/// used to be read into memory, incremented and written back, which drops every
/// update but the last.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ConcurrencyTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    private const int Crowd = 12;

    [Fact]
    public async Task Every_participant_who_joins_at_once_is_counted()
    {
        var (_, poll) = await LivePollAsync();

        var joins = await Task.WhenAll(Enumerable.Range(0, Crowd).Select(i =>
            PostAsync(Anonymous, $"/api/polls/{poll.Id}/join", new JoinPollRequest($"Guest {i}"))));

        Assert.All(joins, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        await using var db = CreateDbContext();
        var stored = await db.Polls.AsNoTracking().SingleAsync(p => p.Id == poll.Id);
        Assert.Equal(Crowd, stored.ParticipantCount);
    }

    [Fact]
    public async Task Joining_a_poll_that_does_not_exist_is_a_404()
    {
        var response = await PostAsync(Anonymous, $"/api/polls/{Guid.NewGuid()}/join", new JoinPollRequest("Ada"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// Scores are keyed on the display name a voter submits, while duplicate
    /// answers are rejected per account. Distinct accounts answering under one
    /// name therefore land on a single score row at the same moment — which is
    /// what a shared team name looks like in practice.
    /// </summary>
    [Fact]
    public async Task Points_from_simultaneous_correct_answers_all_land()
    {
        var (_, poll) = await LivePollAsync();

        var voters = await Task.WhenAll(Enumerable.Range(0, Crowd).Select(async _ => ClientFor(await RegisterAsync())));

        // Response time is measured against the question's start, so pushing that
        // into the past gives every answer a known floor to accumulate.
        const int ElapsedSeconds = 5;
        await using (var setup = CreateDbContext())
        {
            await setup.Polls
                .Where(p => p.Id == poll.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(
                    p => p.QuestionStartedAt, DateTime.UtcNow.AddSeconds(-ElapsedSeconds)));
        }

        try
        {
            var votes = await Task.WhenAll(voters.Select(voter =>
                PostAsync(voter, $"/api/polls/{poll.Id}/votes",
                    new SubmitVoteRequest(0, [1], 1200, "Team Turing"))));

            Assert.All(votes, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

            await using var db = CreateDbContext();
            var score = await db.Scores.AsNoTracking().SingleAsync(s => s.PollId == poll.Id);

            // Option 1 is correct and each question is worth 10.
            Assert.Equal(Crowd * 10, score.Points);
            Assert.True(score.TotalTimeMs >= Crowd * ElapsedSeconds * 1000L, $"summed {score.TotalTimeMs} ms");
        }
        finally
        {
            foreach (var voter in voters) voter.Dispose();
        }
    }

    [Fact]
    public async Task A_term_the_whole_room_submits_at_once_is_tallied_once_per_sender()
    {
        var (_, poll) = await LivePollAsync(WordCloudPoll());

        var submissions = await Task.WhenAll(Enumerable.Range(0, Crowd).Select(i =>
            PostAsync(Anonymous, $"/api/polls/{poll.Id}/wordcloud/submit",
                new WordCloudSubmitRequest(0, ["Kubernetes"], $"Guest {i}"))));

        Assert.All(submissions, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        await using var db = CreateDbContext();
        var question = await db.Questions.AsNoTracking().SingleAsync(q => q.PollId == poll.Id);
        var aggregate = await db.WordCloudAggregates.AsNoTracking()
            .SingleAsync(a => a.QuestionId == question.Id && a.Term == "kubernetes");

        Assert.Equal(Crowd, aggregate.Count);
        Assert.Equal(Crowd, await db.WordCloudSubmissions.CountAsync(s => s.QuestionId == question.Id));
    }

    [Fact]
    public async Task Repeating_a_term_within_one_submission_counts_every_mention_when_repeats_are_allowed()
    {
        var (_, poll) = await LivePollAsync(WordCloudPoll("""{"allowDuplicatesFromSameUser":true}"""));

        var response = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/wordcloud/submit",
            new WordCloudSubmitRequest(0, ["Docker", "docker", "  DOCKER  "], "Ada"));
        response.EnsureSuccessStatusCode();

        await using var db = CreateDbContext();
        var question = await db.Questions.AsNoTracking().SingleAsync(q => q.PollId == poll.Id);
        var aggregate = await db.WordCloudAggregates.AsNoTracking()
            .SingleAsync(a => a.QuestionId == question.Id);

        Assert.Equal("docker", aggregate.Term);
        Assert.Equal(3, aggregate.Count);
    }

    /// <summary>
    /// Poll carries a row version, so overlapping writes to it used to surface
    /// as an unhandled concurrency exception. A losing writer should be told to
    /// retry, not handed a 500.
    /// </summary>
    [Fact]
    public async Task Overlapping_presenter_controls_never_fault_the_server()
    {
        var (owner, poll) = await LivePollAsync();

        var clicks = await Task.WhenAll(Enumerable.Range(0, 20)
            .Select(_ => owner.PostAsync($"/api/polls/{poll.Id}/next-question", (HttpContent?)null)));

        Assert.All(clicks, r =>
            Assert.True(
                r.StatusCode is HttpStatusCode.OK or HttpStatusCode.Conflict,
                $"Expected OK or Conflict but got {(int)r.StatusCode} {r.StatusCode}."));
        Assert.Contains(clicks, r => r.StatusCode == HttpStatusCode.OK);

        await using var db = CreateDbContext();
        var stored = await db.Polls.AsNoTracking().SingleAsync(p => p.Id == poll.Id);

        // The sample quiz has two questions, so advancing at all ends it.
        Assert.Equal(PollStatus.Ended, stored.Status);
    }

    private static CreatePollRequest WordCloudPoll(string? config = null) => new(
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
                WordCloudConfig: config,
                Options: []),
        ]);

    private async Task<(HttpClient Owner, PollDto Poll)> LivePollAsync(CreatePollRequest? request = null)
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, request);
        await ActivateAsync(owner, poll.Id);
        return (owner, poll);
    }
}
