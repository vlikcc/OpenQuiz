using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Votes;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The list endpoints used to return whole tables, so a long-running account or
/// a large audience made a single request grow without bound.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class PaginationTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task The_poll_list_returns_one_page_at_a_time()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        for (var i = 0; i < 7; i++) await CreatePollAsync(owner, SampleQuiz($"Quiz {i}"));

        var first = await ReadAsync<PagedResult<PollSummaryDto>>(
            await owner.GetAsync("/api/polls?page=1&pageSize=3"));

        Assert.Equal(3, first.Items.Count);
        Assert.Equal(7, first.TotalCount);
        Assert.True(first.HasMore);

        var last = await ReadAsync<PagedResult<PollSummaryDto>>(
            await owner.GetAsync("/api/polls?page=3&pageSize=3"));

        Assert.Single(last.Items);
        Assert.False(last.HasMore);
    }

    [Fact]
    public async Task Paging_walks_every_poll_exactly_once()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var created = new List<Guid>();
        for (var i = 0; i < 7; i++) created.Add((await CreatePollAsync(owner, SampleQuiz($"Quiz {i}"))).Id);

        var seen = new List<Guid>();
        for (var page = 1; ; page++)
        {
            var result = await ReadAsync<PagedResult<PollSummaryDto>>(
                await owner.GetAsync($"/api/polls?page={page}&pageSize=2"));
            seen.AddRange(result.Items.Select(p => p.Id));
            if (!result.HasMore) break;
        }

        Assert.Equal(created.Count, seen.Count);
        Assert.Equal(created.Order(), seen.Order());
    }

    [Fact]
    public async Task The_summary_reports_the_question_count_without_shipping_the_questions()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        await CreatePollAsync(owner);

        var listed = await ReadAsync<PagedResult<PollSummaryDto>>(await owner.GetAsync("/api/polls"));

        Assert.Equal(2, listed.Items.Single().QuestionCount);
    }

    /// <summary>
    /// The clamp is what stops a caller from paging the limit away, so it has to
    /// hold for values above the ceiling and below the floor alike.
    /// </summary>
    [Theory]
    [InlineData("pageSize=100000", PageRequest.MaxPageSize)]
    [InlineData("pageSize=0", 1)]
    [InlineData("pageSize=-5", 1)]
    public async Task An_out_of_range_page_size_is_clamped(string query, int expected)
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        await CreatePollAsync(owner);

        var result = await ReadAsync<PagedResult<PollSummaryDto>>(await owner.GetAsync($"/api/polls?{query}"));

        Assert.Equal(expected, result.PageSize);
    }

    [Fact]
    public async Task A_page_before_the_first_one_is_treated_as_the_first()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        await CreatePollAsync(owner);

        var result = await ReadAsync<PagedResult<PollSummaryDto>>(await owner.GetAsync("/api/polls?page=-3"));

        Assert.Equal(1, result.Page);
        Assert.Single(result.Items);
    }

    [Fact]
    public async Task Recorded_votes_are_paged()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        for (var i = 0; i < 5; i++)
        {
            (await PostAsync(Anonymous, $"/api/polls/{poll.Id}/votes",
                new SubmitVoteRequest(0, [1], 900, $"Guest {i}"))).EnsureSuccessStatusCode();
        }

        var page = await ReadAsync<PagedResult<VoteDto>>(
            await owner.GetAsync($"/api/polls/{poll.Id}/votes?page=1&pageSize=2"));

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.TotalCount);
        Assert.True(page.HasMore);
    }

    [Fact]
    public async Task Open_answers_are_paged()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, OpenEndedPoll());
        await ActivateAsync(owner, poll.Id);

        for (var i = 0; i < 5; i++)
        {
            (await PostAsync(Anonymous, $"/api/polls/{poll.Id}/open-answers",
                new SubmitOpenAnswerRequest(0, $"Answer {i}", $"Guest {i}"))).EnsureSuccessStatusCode();
        }

        var page = await ReadAsync<PagedResult<OpenAnswerDto>>(
            await owner.GetAsync($"/api/polls/{poll.Id}/open-answers?page=2&pageSize=2"));

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.TotalCount);
        Assert.True(page.HasMore);
    }

    private static CreatePollRequest OpenEndedPoll() => new(
        "Retro",
        Domain.Enums.PollType.Survey,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "What went well?",
                ImageUrl: null,
                TimeLimit: 120,
                QuestionType: Domain.Enums.QuestionType.Open,
                AllowMultiple: false,
                CorrectOptionIndex: null,
                CorrectAnswer: null,
                Points: 10,
                MaxWords: null,
                WordCloudConfig: null,
                Options: []),
        ]);
}
