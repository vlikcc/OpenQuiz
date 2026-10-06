using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Billing;
using OpenQuiz.Application.Polls;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The load-bearing test for <c>PollService.JoinAsync</c>'s design: the
/// participant cap is folded into the same <c>ExecuteUpdateAsync</c> that
/// increments the count, so the database — not a read-then-write race in
/// application code — makes the cap exact under a concurrent burst.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ParticipantCapTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private const int Cap = 3;
    private const int Crowd = 10;

    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
    };

    [Fact]
    public async Task A_burst_of_joins_never_overshoots_the_plan_cap()
    {
        var auth = await RegisterOnPlanAsync("free");
        await OverrideParticipantCapAsync(auth.User.Id, Cap);

        using var owner = ClientFor(auth);
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var joins = await Task.WhenAll(Enumerable.Range(0, Crowd)
            .Select(i => PostAsync(Anonymous, $"/api/polls/{poll.Id}/join", new JoinPollRequest($"Guest {i}"))));

        Assert.Equal(Cap, joins.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(Crowd - Cap, joins.Count(r => r.StatusCode == HttpStatusCode.PaymentRequired));

        await using var db = CreateDbContext();
        var stored = await db.Polls.AsNoTracking().SingleAsync(p => p.Id == poll.Id);
        Assert.Equal(Cap, stored.ParticipantCount);
    }

    [Fact]
    public async Task Rejected_joiners_get_the_plan_limit_discriminator_not_a_bare_error()
    {
        var auth = await RegisterOnPlanAsync("free");
        await OverrideParticipantCapAsync(auth.User.Id, 1);

        using var owner = ClientFor(auth);
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        (await PostAsync(Anonymous, $"/api/polls/{poll.Id}/join", new JoinPollRequest("First"))).EnsureSuccessStatusCode();
        var rejected = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/join", new JoinPollRequest("Second"));

        Assert.Equal(HttpStatusCode.PaymentRequired, rejected.StatusCode);
        Assert.Equal("application/problem+json", rejected.Content.Headers.ContentType?.MediaType);
    }

    private async Task OverrideParticipantCapAsync(Guid ownerUserId, long cap)
    {
        await using var db = CreateDbContext();
        var account = await db.BillingAccounts.SingleAsync(a => a.OwnerUserId == ownerUserId);
        db.EntitlementOverrides.Add(new EntitlementOverride
        {
            BillingAccountId = account.Id,
            Key = EntitlementKeys.LimitParticipantsPerSession,
            Value = cap,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }
}
