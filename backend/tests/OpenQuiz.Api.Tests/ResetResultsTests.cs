using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Votes;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// A teacher runs the same quiz with every class. Without a way to clear the
/// previous class's answers, the second class could not vote (they had
/// "already answered") and inherited the first class's standings.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ResetResultsTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Clearing_drops_the_answers_scores_and_reactions_but_keeps_the_questions()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        (await VoteAsync(poll.Id, "Ada", correct: true)).EnsureSuccessStatusCode();
        (await PostAsync(Anonymous, $"/api/polls/{poll.Id}/reactions", new ReactionRequest("👏", "Ada")))
            .EnsureSuccessStatusCode();

        var reset = await ReadAsync<PollDto>(await owner.PostAsync($"/api/polls/{poll.Id}/reset-results", null));

        Assert.Equal(PollStatus.Waiting, reset.Status);
        Assert.False(reset.IsActive);
        Assert.Equal(0, reset.CurrentQuestionIndex);
        Assert.Equal(0, reset.ParticipantCount);
        Assert.Equal(poll.JoinCode, reset.JoinCode);
        Assert.Equal(2, reset.Questions.Count);

        await using var db = CreateDbContext();
        Assert.False(await db.Votes.AnyAsync(v => v.PollId == poll.Id));
        Assert.False(await db.Scores.AnyAsync(s => s.PollId == poll.Id));
        Assert.False(await db.Reactions.AnyAsync(r => r.PollId == poll.Id));
    }

    [Fact]
    public async Task The_next_group_can_answer_under_the_same_names()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);
        (await VoteAsync(poll.Id, "Ada", correct: true)).EnsureSuccessStatusCode();

        (await owner.PostAsync($"/api/polls/{poll.Id}/reset-results", null)).EnsureSuccessStatusCode();
        await ActivateAsync(owner, poll.Id);

        (await VoteAsync(poll.Id, "Ada", correct: false)).EnsureSuccessStatusCode();

        await using var db = CreateDbContext();
        Assert.False(await db.Scores.AnyAsync(s => s.PollId == poll.Id && s.Points > 0));
    }

    [Fact]
    public async Task The_room_is_told_the_poll_is_back_in_the_waiting_room()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        (await owner.PostAsync($"/api/polls/{poll.Id}/reset-results", null)).EnsureSuccessStatusCode();

        Assert.Equal(PollStatus.Waiting, Api.Realtime.PollUpdates.Last().Status);
    }

    [Fact]
    public async Task Only_the_owner_can_clear_a_poll()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);
        (await VoteAsync(poll.Id, "Ada", correct: true)).EnsureSuccessStatusCode();

        using var stranger = ClientFor(await RegisterCreatorAsync());
        var response = await stranger.PostAsync($"/api/polls/{poll.Id}/reset-results", null);
        var anonymous = await Anonymous.PostAsync($"/api/polls/{poll.Id}/reset-results", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        await using var db = CreateDbContext();
        Assert.True(await db.Votes.AnyAsync(v => v.PollId == poll.Id));
    }

    private Task<HttpResponseMessage> VoteAsync(Guid pollId, string voter, bool correct) =>
        PostAsync(Anonymous, $"/api/polls/{pollId}/votes",
            new SubmitVoteRequest(0, [correct ? 1 : 0], 500, voter));
}
