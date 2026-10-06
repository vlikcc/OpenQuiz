using System.Net.Http.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Scores;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Services;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The scores endpoint is anonymous so the presenter and voter screens can
/// load standings without an account. Without a clamp, anyone with a poll id
/// could pull the full named roster.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class AnonymousLeaderboardTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task An_anonymous_caller_cannot_pull_more_than_the_public_cap()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await SeedScoresAsync(poll.Id, ScoreService.PublicTop + 10);

        var rows = await ReadAsync<List<ScoreEntry>>(
            await Anonymous.GetAsync($"/api/scores?pollId={poll.Id}&top=500"));

        Assert.Equal(ScoreService.PublicTop, rows.Count);
    }

    [Fact]
    public async Task The_owner_can_pull_the_full_standings()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        var seeded = ScoreService.PublicTop + 10;
        await SeedScoresAsync(poll.Id, seeded);

        var rows = await ReadAsync<List<ScoreEntry>>(
            await owner.GetAsync($"/api/scores?pollId={poll.Id}&top=500"));

        Assert.Equal(seeded, rows.Count);
    }

    [Fact]
    public async Task A_signed_in_stranger_is_clamped_the_same_as_anonymous()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await SeedScoresAsync(poll.Id, ScoreService.PublicTop + 10);

        using var stranger = ClientFor(await RegisterCreatorAsync());
        var rows = await ReadAsync<List<ScoreEntry>>(
            await stranger.GetAsync($"/api/scores?pollId={poll.Id}&top=500"));

        Assert.Equal(ScoreService.PublicTop, rows.Count);
    }

    private async Task SeedScoresAsync(Guid pollId, int count)
    {
        await using var db = CreateDbContext();
        for (var i = 0; i < count; i++)
        {
            db.Scores.Add(new Score
            {
                PollId = pollId,
                UserName = $"User{i:D2}",
                Points = 100 - i,
                TotalTimeMs = i * 10,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync();
    }
}
