using System.Net;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Auth;
using OpenQuiz.Application.Polls;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class RateLimitingTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private const int AuthPermitLimit = 3;

    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["RateLimiting:Enabled"] = "true",
        ["RateLimiting:Auth:PermitLimit"] = AuthPermitLimit.ToString(),
        ["RateLimiting:Auth:WindowSeconds"] = "60",
        ["RateLimiting:Participation:PermitLimit"] = "1000",
        ["RateLimiting:Participation:WindowSeconds"] = "60",
    };

    [Fact]
    public async Task Credential_stuffing_against_login_is_cut_off()
    {
        var attempts = new List<HttpResponseMessage>();
        for (var i = 0; i < AuthPermitLimit + 2; i++)
        {
            attempts.Add(await PostAsync(Anonymous, "/api/auth/login",
                new LoginRequest(UniqueEmail("victim"), "guess")));
        }

        Assert.Equal(AuthPermitLimit, attempts.Count(r => r.StatusCode == HttpStatusCode.Unauthorized));

        var rejected = attempts.Skip(AuthPermitLimit).ToList();
        Assert.All(rejected, r => Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode));
        Assert.All(rejected, r => Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType));
        Assert.All(rejected, r => Assert.NotNull(r.Headers.RetryAfter));
    }

    [Fact]
    public async Task The_auth_budget_does_not_spill_over_onto_participants()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        // Burn the auth window; joining runs on its own, far larger budget.
        for (var i = 0; i < AuthPermitLimit + 2; i++)
            await PostAsync(Anonymous, "/api/auth/login", new LoginRequest(UniqueEmail(), "guess"));

        var joined = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/join", new JoinPollRequest("Ada"));

        Assert.Equal(HttpStatusCode.OK, joined.StatusCode);
    }
}
