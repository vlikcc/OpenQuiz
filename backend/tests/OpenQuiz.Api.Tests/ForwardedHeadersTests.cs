using System.Net;
using System.Net.Http.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Auth;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Behind an outer proxy plus the web container's nginx, X-Forwarded-For
/// carries two hops. Unwinding only one of them read nginx's own address, so
/// every visitor landed in the same rate-limit bucket and one busy room locked
/// everybody else out.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ForwardedHeadersTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private const int AuthPermitLimit = 3;
    private const string NginxHop = "172.18.0.5";

    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["RateLimiting:Enabled"] = "true",
        ["RateLimiting:TrustForwardedHeaders"] = "true",
        ["RateLimiting:ForwardLimit"] = "2",
        ["RateLimiting:Auth:PermitLimit"] = AuthPermitLimit.ToString(),
        ["RateLimiting:Auth:WindowSeconds"] = "60",
    };

    [Fact]
    public async Task Two_visitors_behind_the_same_proxies_get_their_own_budgets()
    {
        await ExhaustAsync("203.0.113.1");

        var other = await LoginFromAsync("203.0.113.2");

        Assert.Equal(HttpStatusCode.Unauthorized, other.StatusCode);
    }

    [Fact]
    public async Task One_visitor_is_still_cut_off()
    {
        await ExhaustAsync("203.0.113.3");

        var again = await LoginFromAsync("203.0.113.3");

        Assert.Equal(HttpStatusCode.TooManyRequests, again.StatusCode);
    }

    private async Task ExhaustAsync(string clientIp)
    {
        for (var i = 0; i < AuthPermitLimit; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginFromAsync(clientIp)).StatusCode);
    }

    private Task<HttpResponseMessage> LoginFromAsync(string clientIp)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new LoginRequest(UniqueEmail("visitor"), "guess")),
        };
        request.Headers.Add("X-Forwarded-For", $"{clientIp}, {NginxHop}");
        return Anonymous.SendAsync(request);
    }
}
