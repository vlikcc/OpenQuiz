using System.Net;
using System.Net.Http.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Polls;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class PollAuthorizationTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Listing_polls_requires_a_signed_in_caller()
    {
        var response = await Anonymous.GetAsync("/api/polls");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_plain_account_cannot_author_polls()
    {
        using var client = ClientFor(await RegisterAsync());

        var response = await PostAsync(client, "/api/polls", SampleQuiz());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_list_only_shows_the_callers_own_polls()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterCreatorAsync());

        var mine = await CreatePollAsync(owner, SampleQuiz("Mine"));
        await CreatePollAsync(stranger, SampleQuiz("Theirs"));

        var visible = await ReadAsync<PagedResult<PollSummaryDto>>(await owner.GetAsync("/api/polls"));

        Assert.Equal([mine.Id], visible.Items.Select(p => p.Id).ToArray());
        Assert.Equal(1, visible.TotalCount);
    }

    [Theory]
    [InlineData("activate")]
    [InlineData("next-question")]
    [InlineData("prev-question")]
    [InlineData("end")]
    public async Task Only_the_owner_can_drive_the_session(string action)
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);

        var response = await stranger.PostAsync($"/api/polls/{poll.Id}/{action}", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_stranger_cannot_rewrite_someone_elses_poll()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);

        var quiz = SampleQuiz("Hijacked");
        var response = await stranger.PutAsJsonAsync(
            $"/api/polls/{poll.Id}",
            new UpdatePollRequest(quiz.Title, quiz.Type, quiz.Questions));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_stranger_cannot_delete_someone_elses_poll()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);

        var response = await stranger.DeleteAsync($"/api/polls/{poll.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Raw_vote_records_stay_with_the_owner()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        using var stranger = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Anonymous.GetAsync($"/api/polls/{poll.Id}/votes")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await stranger.GetAsync($"/api/polls/{poll.Id}/votes")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/api/polls/{poll.Id}/votes")).StatusCode);
    }
}
