using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.WordCloud;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// A word cloud is projected on a wall in front of a room, which makes it the
/// one screen where an unmoderated submission is most expensive.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class WordCloudModerationTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task A_word_on_the_organisers_blacklist_never_reaches_the_wall()
    {
        var poll = await LiveCloudAsync("""{"blacklist":["spam","reklam"]}""");

        var refused = await SubmitAsync(poll.Id, ["Spam"], "Ada");
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);

        var mixed = await SubmitAsync(poll.Id, ["reklam", "kubernetes"], "Ada");
        mixed.EnsureSuccessStatusCode();

        var cloud = await ReadAsync<WordCloudResponse>(mixed);
        Assert.Equal(["kubernetes"], cloud.Terms.Select(t => t.Term).ToArray());
    }

    [Fact]
    public async Task Profanity_is_dropped_without_the_organiser_listing_it()
    {
        var poll = await LiveCloudAsync();

        var refused = await SubmitAsync(poll.Id, ["orospu"], "Ada");

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Empty(await TermsAsync(poll.Id));
    }

    /// <summary>
    /// Padding a word with digits and punctuation is the first thing anyone
    /// tries once they notice the plain spelling is refused.
    /// </summary>
    [Theory]
    [InlineData("fu.ck")]
    [InlineData("f-u-c-k")]
    [InlineData("shiiiit")]
    [InlineData("b1tch")]
    public async Task A_disguised_spelling_is_caught_too(string attempt)
    {
        var poll = await LiveCloudAsync();

        var refused = await SubmitAsync(poll.Id, [attempt], "Ada");

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
    }

    /// <summary>
    /// A filter that eats ordinary words is worse than one that misses a
    /// creative spelling. "şık" folds onto a Turkish obscenity if diacritics are
    /// stripped, and "class" contains one in English.
    /// </summary>
    [Theory]
    [InlineData("şık")]
    [InlineData("class")]
    [InlineData("assignment")]
    [InlineData("mal")]
    public async Task An_innocent_word_that_looks_like_one_is_left_alone(string word)
    {
        var poll = await LiveCloudAsync();

        var response = await SubmitAsync(poll.Id, [word], "Ada");

        response.EnsureSuccessStatusCode();
        Assert.Contains(word, await TermsAsync(poll.Id));
    }

    [Fact]
    public async Task The_same_participant_cannot_stuff_the_ballot_with_one_word()
    {
        var poll = await LiveCloudAsync();

        (await SubmitAsync(poll.Id, ["redis", "redis", "REDIS"], "Ada")).EnsureSuccessStatusCode();
        var again = await SubmitAsync(poll.Id, ["Redis"], "Ada");

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal(1, await CountAsync(poll.Id, "redis"));
    }

    [Fact]
    public async Task A_repeat_from_a_different_participant_still_counts()
    {
        var poll = await LiveCloudAsync();

        (await SubmitAsync(poll.Id, ["redis"], "Ada")).EnsureSuccessStatusCode();
        (await SubmitAsync(poll.Id, ["redis"], "Grace")).EnsureSuccessStatusCode();

        Assert.Equal(2, await CountAsync(poll.Id, "redis"));
    }

    [Fact]
    public async Task A_second_word_survives_when_only_the_repeat_is_dropped()
    {
        var poll = await LiveCloudAsync();

        (await SubmitAsync(poll.Id, ["redis"], "Ada")).EnsureSuccessStatusCode();
        (await SubmitAsync(poll.Id, ["redis", "nginx"], "Ada")).EnsureSuccessStatusCode();

        Assert.Equal(1, await CountAsync(poll.Id, "redis"));
        Assert.Equal(1, await CountAsync(poll.Id, "nginx"));
    }

    [Fact]
    public async Task The_cloud_shows_only_as_many_words_as_the_question_asks_for()
    {
        var poll = await LiveCloudAsync("""{"topN":2}""");

        foreach (var (term, senders) in new[] { ("redis", 3), ("nginx", 2), ("kafka", 1) })
        {
            for (var i = 0; i < senders; i++)
                (await SubmitAsync(poll.Id, [term], $"Guest {term}{i}")).EnsureSuccessStatusCode();
        }

        var cloud = await ReadAsync<WordCloudResponse>(
            await Anonymous.GetAsync($"/api/polls/{poll.Id}/wordcloud/0"));

        Assert.Equal(["redis", "nginx"], cloud.Terms.Select(t => t.Term).ToArray());

        // The tail is recorded even though the wall does not show it.
        Assert.Equal(1, await CountAsync(poll.Id, "kafka"));
    }

    /// <summary>
    /// Blacklisting mid-session is a reaction to something already on the wall,
    /// so it has to clear that word rather than only stop the next sender.
    /// </summary>
    [Fact]
    public async Task Blacklisting_a_word_mid_session_clears_it_from_the_wall()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, CloudPoll());
        await ActivateAsync(owner, poll.Id);
        (await SubmitAsync(poll.Id, ["kubernetes", "nginx"], "Ada")).EnsureSuccessStatusCode();

        await using (var db = CreateDbContext())
        {
            await db.Questions
                .Where(q => q.PollId == poll.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(
                    q => q.WordCloudConfig, """{"blacklist":["kubernetes"]}"""));
        }

        var cloud = await ReadAsync<WordCloudResponse>(
            await Anonymous.GetAsync($"/api/polls/{poll.Id}/wordcloud/0"));

        Assert.Equal(["nginx"], cloud.Terms.Select(t => t.Term).ToArray());
    }

    [Fact]
    public async Task A_word_shorter_than_the_question_allows_is_refused()
    {
        var poll = await LiveCloudAsync("""{"minTermLength":4}""");

        var refused = await SubmitAsync(poll.Id, ["go"], "Ada");

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
    }

    /// <summary>
    /// A live room is the worst place to discover a typo in the settings, so the
    /// submission goes through on the defaults rather than failing.
    /// </summary>
    [Fact]
    public async Task Unreadable_settings_fall_back_to_the_defaults()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, CloudPoll());
        await ActivateAsync(owner, poll.Id);

        await using (var db = CreateDbContext())
        {
            await db.Questions
                .Where(q => q.PollId == poll.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(q => q.WordCloudConfig, "{not json"));
        }

        (await SubmitAsync(poll.Id, ["kubernetes"], "Ada")).EnsureSuccessStatusCode();
        Assert.Equal(1, await CountAsync(poll.Id, "kubernetes"));
    }

    [Fact]
    public async Task Settings_that_cannot_be_read_are_refused_at_authoring_time()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());

        var response = await PostAsync(owner, "/api/polls", CloudPoll("""{"topN":"lots"}"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private Task<HttpResponseMessage> SubmitAsync(Guid pollId, List<string> terms, string userName) =>
        PostAsync(Anonymous, $"/api/polls/{pollId}/wordcloud/submit",
            new WordCloudSubmitRequest(0, terms, userName));

    private async Task<PollDto> LiveCloudAsync(string? config = null)
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, CloudPoll(config));
        await ActivateAsync(owner, poll.Id);
        return poll;
    }

    private async Task<List<string>> TermsAsync(Guid pollId)
    {
        await using var db = CreateDbContext();
        return await db.WordCloudAggregates.AsNoTracking()
            .Where(a => db.Questions.Any(q => q.Id == a.QuestionId && q.PollId == pollId))
            .Select(a => a.Term)
            .ToListAsync();
    }

    private async Task<int> CountAsync(Guid pollId, string term)
    {
        await using var db = CreateDbContext();
        return await db.WordCloudAggregates.AsNoTracking()
            .Where(a => a.Term == term && db.Questions.Any(q => q.Id == a.QuestionId && q.PollId == pollId))
            .Select(a => a.Count)
            .SingleOrDefaultAsync();
    }

    private static CreatePollRequest CloudPoll(string? config = null) => new(
        "Which tools do you use?",
        PollType.WordCloud,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "Name a tool",
                ImageUrl: null,
                TimeLimit: 600,
                QuestionType: QuestionType.WordCloud,
                AllowMultiple: false,
                CorrectOptionIndex: null,
                CorrectAnswer: null,
                Points: 10,
                MaxWords: 5,
                WordCloudConfig: config,
                Options: []),
        ]);
}
