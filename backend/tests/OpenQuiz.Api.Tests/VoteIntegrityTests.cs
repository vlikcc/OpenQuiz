using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Votes;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class VoteIntegrityTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task An_anonymous_voter_can_only_answer_a_question_once()
    {
        var (_, poll) = await LivePollAsync();

        var first = await SubmitAsync(Anonymous, poll.Id, questionIndex: 0, option: 1, voter: "Ada");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await SubmitAsync(Anonymous, poll.Id, questionIndex: 0, option: 2, voter: "Ada");
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);

        await using var db = CreateDbContext();
        Assert.Equal(1, await db.Votes.CountAsync(v => v.PollId == poll.Id));
    }

    [Fact]
    public async Task The_name_check_ignores_casing_and_padding()
    {
        var (_, poll) = await LivePollAsync();

        await SubmitAsync(Anonymous, poll.Id, 0, 1, "Ada");
        var again = await SubmitAsync(Anonymous, poll.Id, 0, 2, "  aDa ");

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task Different_participants_still_get_their_own_vote()
    {
        var (_, poll) = await LivePollAsync();

        Assert.Equal(HttpStatusCode.OK, (await SubmitAsync(Anonymous, poll.Id, 0, 1, "Ada")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SubmitAsync(Anonymous, poll.Id, 0, 2, "Grace")).StatusCode);

        await using var db = CreateDbContext();
        Assert.Equal(2, await db.Votes.CountAsync(v => v.PollId == poll.Id));
    }

    [Fact]
    public async Task A_signed_in_voter_is_deduplicated_on_the_account_not_the_name()
    {
        var (_, poll) = await LivePollAsync();
        using var voter = ClientFor(await RegisterAsync());

        Assert.Equal(HttpStatusCode.OK, (await SubmitAsync(voter, poll.Id, 0, 1, "Ada")).StatusCode);

        // Same account, new display name: still the same person.
        var renamed = await SubmitAsync(voter, poll.Id, 0, 2, "Ada Lovelace");
        Assert.Equal(HttpStatusCode.Conflict, renamed.StatusCode);
    }

    [Fact]
    public async Task A_poll_that_has_not_started_accepts_nothing()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);

        var response = await SubmitAsync(Anonymous, poll.Id, 0, 1, "Ada");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_finished_poll_accepts_nothing()
    {
        var (owner, poll) = await LivePollAsync();
        (await owner.PostAsync($"/api/polls/{poll.Id}/end", null)).EnsureSuccessStatusCode();

        var response = await SubmitAsync(Anonymous, poll.Id, 0, 1, "Ada");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Answers_for_a_question_the_presenter_left_behind_are_refused()
    {
        var (owner, poll) = await LivePollAsync();
        (await owner.PostAsync($"/api/polls/{poll.Id}/next-question", null)).EnsureSuccessStatusCode();

        var stale = await SubmitAsync(Anonymous, poll.Id, questionIndex: 0, option: 1, voter: "Ada");
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);

        var current = await SubmitAsync(Anonymous, poll.Id, questionIndex: 1, option: 0, voter: "Ada");
        Assert.Equal(HttpStatusCode.OK, current.StatusCode);
    }

    [Fact]
    public async Task Answers_for_a_question_the_presenter_has_not_reached_are_refused()
    {
        var (_, poll) = await LivePollAsync();

        var response = await SubmitAsync(Anonymous, poll.Id, questionIndex: 1, option: 0, voter: "Ada");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_double_click_race_still_records_one_vote_and_one_score()
    {
        var (_, poll) = await LivePollAsync();

        var attempts = await Task.WhenAll(Enumerable.Range(0, 8)
            .Select(_ => SubmitAsync(Anonymous, poll.Id, 0, 1, "Ada")));

        Assert.Equal(1, attempts.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(attempts.Where(r => r.StatusCode != HttpStatusCode.OK),
            r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        await using var db = CreateDbContext();
        Assert.Equal(1, await db.Votes.CountAsync(v => v.PollId == poll.Id));

        // Option 1 is the correct answer, so a duplicate that slipped through
        // would show up as double points.
        var score = await db.Scores.SingleAsync(s => s.PollId == poll.Id);
        Assert.Equal(10, score.Points);
    }

    [Fact]
    public async Task Aggregates_count_each_participant_once_per_question()
    {
        var (_, poll) = await LivePollAsync();
        await SubmitAsync(Anonymous, poll.Id, 0, 1, "Ada");
        await SubmitAsync(Anonymous, poll.Id, 0, 1, "Grace");
        await SubmitAsync(Anonymous, poll.Id, 0, 2, "Alan");

        var aggregates = await ReadAsync<List<QuestionAggregate>>(
            await Anonymous.GetAsync($"/api/polls/{poll.Id}/aggregates"));

        var first = aggregates.Single(a => a.QuestionIndex == 0);
        Assert.Equal(3, first.TotalRespondents);
        Assert.Equal(2, first.OptionCounts[1]);
        Assert.Equal(1, first.OptionCounts[2]);
    }

    private async Task<(HttpClient Owner, PollDto Poll)> LivePollAsync()
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);
        return (owner, poll);
    }

    private static Task<HttpResponseMessage> SubmitAsync(
        HttpClient client, Guid pollId, int questionIndex, int option, string voter) =>
        PostAsync(client, $"/api/polls/{pollId}/votes",
            new SubmitVoteRequest(questionIndex, [option], 1200, voter));
}
