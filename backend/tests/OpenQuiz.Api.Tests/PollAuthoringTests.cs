using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Authoring concerns that are not about who may do what: copying a poll to run
/// it again, and surviving a question list a client numbered badly.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class PollAuthoringTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task A_copy_carries_the_questions_and_starts_unplayed()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var source = await CreatePollAsync(owner, SampleQuiz("Monday's quiz"));
        await ActivateAsync(owner, source.Id);

        var copy = await ReadAsync<PollDto>(await DuplicateAsync(owner, source.Id));

        Assert.NotEqual(source.Id, copy.Id);
        Assert.Equal("Monday's quiz (kopya)", copy.Title);
        Assert.Equal(PollStatus.Waiting, copy.Status);
        Assert.False(copy.IsActive);
        Assert.Equal(0, copy.ParticipantCount);
        Assert.Null(copy.QuestionStartedAt);

        Assert.Equal(
            source.Questions.Select(q => (q.Text, q.TimeLimit, q.CorrectOptionIndex, q.Options.Count)),
            copy.Questions.Select(q => (q.Text, q.TimeLimit, q.CorrectOptionIndex, q.Options.Count)));
    }

    [Fact]
    public async Task A_copy_is_a_separate_poll_that_the_original_does_not_feel()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var source = await CreatePollAsync(owner);
        var copy = await ReadAsync<PollDto>(await DuplicateAsync(owner, source.Id));

        await ActivateAsync(owner, copy.Id);
        (await PostAsync(Anonymous, $"/api/polls/{copy.Id}/votes",
            new Application.Votes.SubmitVoteRequest(0, [1], 500, "Ada"))).EnsureSuccessStatusCode();

        await using var db = CreateDbContext();
        Assert.Empty(await db.Votes.AsNoTracking().Where(v => v.PollId == source.Id).ToListAsync());
        Assert.Equal(PollStatus.Waiting, (await db.Polls.AsNoTracking().SingleAsync(p => p.Id == source.Id)).Status);

        // Editing the copy must not reach back into the original's questions.
        var sourceQuestionIds = source.Questions.Select(q => q.Id).ToHashSet();
        Assert.DoesNotContain(copy.Questions[0].Id, sourceQuestionIds);
    }

    [Fact]
    public async Task The_caller_can_name_the_copy()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var source = await CreatePollAsync(owner);

        var copy = await ReadAsync<PollDto>(await DuplicateAsync(owner, source.Id, "Second group"));

        Assert.Equal("Second group", copy.Title);
    }

    [Fact]
    public async Task Word_cloud_moderation_comes_along_with_the_copy()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var source = await CreatePollAsync(owner, ModeratedCloud());

        var copy = await ReadAsync<PollDto>(await DuplicateAsync(owner, source.Id));

        Assert.Equal("""{"blacklist":["spam"],"topN":10}""", copy.Questions[0].WordCloudConfig);
        Assert.Equal(4, copy.Questions[0].MaxWords);
    }

    [Fact]
    public async Task A_stranger_cannot_copy_someone_elses_poll()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterCreatorAsync());
        var source = await CreatePollAsync(owner);

        Assert.Equal(HttpStatusCode.Forbidden, (await DuplicateAsync(stranger, source.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await DuplicateAsync(Anonymous, source.Id)).StatusCode);
    }

    [Fact]
    public async Task An_account_without_authoring_rights_cannot_copy()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var source = await CreatePollAsync(owner);

        // The plain account is not the owner either, so the refusal is expected
        // whichever check fires first.
        using var plain = ClientFor(await RegisterAsync());
        Assert.Equal(HttpStatusCode.Forbidden, (await DuplicateAsync(plain, source.Id)).StatusCode);
    }

    [Fact]
    public async Task Copying_a_poll_that_does_not_exist_is_a_404()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());

        Assert.Equal(HttpStatusCode.NotFound, (await DuplicateAsync(owner, Guid.NewGuid())).StatusCode);
    }

    /// <summary>
    /// Order indices are unique per poll in the database, so a client that
    /// repeated or skipped one used to take the whole request down with a 500.
    /// </summary>
    [Fact]
    public async Task A_question_list_numbered_badly_is_renumbered_rather_than_refused()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var quiz = SampleQuiz("Numbered badly");
        var confused = quiz with
        {
            Questions =
            [
                quiz.Questions[0] with { OrderIndex = 7 },
                quiz.Questions[1] with { OrderIndex = 7 },
            ]
        };

        var created = await CreatePollAsync(owner, confused);

        Assert.Equal([0, 1], created.Questions.Select(q => q.OrderIndex).ToArray());
    }

    private static Task<HttpResponseMessage> DuplicateAsync(HttpClient client, Guid pollId, string? title = null) =>
        client.PostAsJsonAsync($"/api/polls/{pollId}/duplicate", new DuplicatePollRequest(title));

    private static CreatePollRequest ModeratedCloud() => new(
        "Tools",
        PollType.WordCloud,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "Name a tool",
                ImageUrl: "https://example.test/tool.png",
                TimeLimit: 60,
                QuestionType: QuestionType.WordCloud,
                AllowMultiple: false,
                CorrectOptionIndex: null,
                CorrectAnswer: null,
                Points: 10,
                MaxWords: 4,
                WordCloudConfig: """{"blacklist":["spam"],"topN":10}""",
                Options: []),
        ]);
}
