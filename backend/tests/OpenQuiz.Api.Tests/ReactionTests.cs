using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Realtime;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Reactions were broadcast and then forgotten, so the part of a session that
/// says how the room felt about a question was gone the moment it ended.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ReactionTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task A_reaction_outlives_the_broadcast()
    {
        var pollId = await PollAsync();

        (await SendAsync(pollId, "👏")).EnsureSuccessStatusCode();

        await using var db = CreateDbContext();
        var stored = await db.Reactions.AsNoTracking().SingleAsync(r => r.PollId == pollId);
        Assert.Equal("👏", stored.Emoji);
        Assert.Equal("Ada", stored.Sender);
    }

    [Fact]
    public async Task The_tally_counts_each_reaction_over_the_whole_session()
    {
        var pollId = await PollAsync();

        foreach (var emoji in new[] { "👏", "👏", "❤️" })
            (await SendAsync(pollId, emoji)).EnsureSuccessStatusCode();

        var tally = await ReadAsync<List<ReactionTally>>(
            await Anonymous.GetAsync($"/api/polls/{pollId}/reactions"));

        Assert.Equal([new ReactionTally("👏", 2), new ReactionTally("❤️", 1)], tally);
    }

    /// <summary>
    /// The reaction goes straight onto a screen in front of a room with nobody
    /// approving it, so it cannot be allowed to carry words.
    /// </summary>
    [Theory]
    [InlineData("buy now")]
    [InlineData("boo")]
    [InlineData("42")]
    public async Task Anything_that_is_not_a_symbol_is_refused(string attempt)
    {
        var pollId = await PollAsync();

        var response = await SendAsync(pollId, attempt);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var db = CreateDbContext();
        Assert.Empty(await db.Reactions.AsNoTracking().Where(r => r.PollId == pollId).ToListAsync());
    }

    [Fact]
    public async Task A_reaction_for_a_poll_that_does_not_exist_is_a_404()
    {
        var response = await SendAsync(Guid.NewGuid(), "👏");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private Task<HttpResponseMessage> SendAsync(Guid pollId, string emoji) =>
        PostAsync(Anonymous, $"/api/polls/{pollId}/reactions", new ReactionRequest(emoji, "Ada"));

    private async Task<Guid> PollAsync()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        return (await CreatePollAsync(owner)).Id;
    }
}
