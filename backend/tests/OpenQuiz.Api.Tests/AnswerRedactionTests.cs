using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class AnswerRedactionTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task An_audience_member_cannot_read_the_answer_key_of_a_running_poll()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var seen = await ReadAsync<PollDto>(await Anonymous.GetAsync($"/api/polls/{poll.Id}"));

        Assert.All(seen.Questions, q => Assert.Null(q.CorrectOptionIndex));
        Assert.All(seen.Questions, q => Assert.Null(q.CorrectAnswer));
        // Redaction must not cost the participant anything else.
        Assert.Equal(2, seen.Questions.Count);
        Assert.Equal(3, seen.Questions[0].Options.Count);
    }

    [Fact]
    public async Task A_signed_in_stranger_cannot_read_the_answer_key_either()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var seen = await ReadAsync<PollDto>(await stranger.GetAsync($"/api/polls/{poll.Id}"));

        Assert.All(seen.Questions, q => Assert.Null(q.CorrectOptionIndex));
    }

    [Fact]
    public async Task The_owner_keeps_the_answer_key()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var seen = await ReadAsync<PollDto>(await owner.GetAsync($"/api/polls/{poll.Id}"));

        Assert.Equal(1, seen.Questions[0].CorrectOptionIndex);
        Assert.Equal(0, seen.Questions[1].CorrectOptionIndex);
    }

    [Fact]
    public async Task Ending_the_poll_releases_the_answer_key_to_everyone()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        (await owner.PostAsync($"/api/polls/{poll.Id}/end", null)).EnsureSuccessStatusCode();

        var seen = await ReadAsync<PollDto>(await Anonymous.GetAsync($"/api/polls/{poll.Id}"));

        Assert.Equal(1, seen.Questions[0].CorrectOptionIndex);
    }

    [Fact]
    public async Task Joining_broadcasts_a_redacted_poll_while_it_runs()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var joined = await ReadAsync<PollDto>(
            await PostAsync(Anonymous, $"/api/polls/{poll.Id}/join", new JoinPollRequest("Ada")));

        Assert.All(joined.Questions, q => Assert.Null(q.CorrectOptionIndex));

        // The hub group is anonymous, so the broadcast is the widest audience of
        // all and has to be redacted at the source.
        var broadcast = Assert.Single(Api.Realtime.PollUpdates, p => p.Id == poll.Id && p.ParticipantCount == 1);
        Assert.All(broadcast.Questions, q => Assert.Null(q.CorrectOptionIndex));
    }

    [Fact]
    public async Task Advancing_the_question_broadcasts_a_redacted_poll_but_answers_the_owner_in_full()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var response = await ReadAsync<PollDto>(await owner.PostAsync($"/api/polls/{poll.Id}/next-question", null));

        Assert.Equal(1, response.CurrentQuestionIndex);
        Assert.Equal(1, response.Questions[0].CorrectOptionIndex);

        var broadcast = Assert.Single(Api.Realtime.PollUpdates, p => p.CurrentQuestionIndex == 1);
        Assert.All(broadcast.Questions, q => Assert.Null(q.CorrectOptionIndex));
    }
}
