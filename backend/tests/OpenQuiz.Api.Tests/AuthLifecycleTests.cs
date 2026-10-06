using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Auth;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class AuthLifecycleTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Register_then_refresh_then_logout_walks_the_whole_session()
    {
        var email = UniqueEmail();
        var registered = await RegisterAsync(email);

        using var client = ClientFor(registered);
        var me = await ReadAsync<UserDto>(await client.GetAsync("/api/auth/me"));
        Assert.Equal(email, me.Email);

        var refreshed = await ReadAsync<AuthResponse>(
            await PostAsync(Anonymous, "/api/auth/refresh", new RefreshRequest(registered.RefreshToken)));
        Assert.NotEqual(registered.RefreshToken, refreshed.RefreshToken);

        // The refresh rotates, so replaying the spent token must not work.
        var replay = await PostAsync(Anonymous, "/api/auth/refresh", new RefreshRequest(registered.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        var loggedOut = await PostAsync(Anonymous, "/api/auth/logout", new LogoutRequest(refreshed.RefreshToken));
        Assert.Equal(HttpStatusCode.NoContent, loggedOut.StatusCode);

        var afterLogout = await PostAsync(Anonymous, "/api/auth/refresh", new RefreshRequest(refreshed.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
    }

    [Fact]
    public async Task Me_requires_a_token()
    {
        var response = await Anonymous.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Registering_the_same_address_twice_conflicts()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);

        var second = await PostAsync(Anonymous, "/api/auth/register",
            new RegisterRequest(email, ValidPassword, "Duplicate"));

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Login_rejects_a_wrong_password()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);

        var response = await PostAsync(Anonymous, "/api/auth/login", new LoginRequest(email, "not-the-password"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Password_reset_revokes_every_outstanding_session()
    {
        var email = UniqueEmail();
        var first = await RegisterAsync(email);
        var second = await ReadAsync<AuthResponse>(
            await PostAsync(Anonymous, "/api/auth/login", new LoginRequest(email, ValidPassword)));

        var requested = await PostAsync(Anonymous, "/api/auth/password-reset/request", new PasswordResetRequest(email));
        Assert.Equal(HttpStatusCode.Accepted, requested.StatusCode);

        var token = ExtractResetToken(Assert.Single(Api.Emails.Sent).HtmlBody);
        var confirmed = await PostAsync(Anonymous, "/api/auth/password-reset/confirm",
            new PasswordResetConfirm(token, "Br4ndNewPassword!"));
        Assert.Equal(HttpStatusCode.NoContent, confirmed.StatusCode);

        // Both sessions predate the reset, so a stolen refresh token is now dead.
        foreach (var stale in new[] { first.RefreshToken, second.RefreshToken })
        {
            var response = await PostAsync(Anonymous, "/api/auth/refresh", new RefreshRequest(stale));
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        var withNewPassword = await PostAsync(Anonymous, "/api/auth/login", new LoginRequest(email, "Br4ndNewPassword!"));
        Assert.Equal(HttpStatusCode.OK, withNewPassword.StatusCode);
    }

    [Fact]
    public async Task Password_reset_invalidates_the_other_pending_links()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);

        await PostAsync(Anonymous, "/api/auth/password-reset/request", new PasswordResetRequest(email));
        await PostAsync(Anonymous, "/api/auth/password-reset/request", new PasswordResetRequest(email));

        var tokens = Api.Emails.Sent.Select(m => ExtractResetToken(m.HtmlBody)).ToList();
        Assert.Equal(2, tokens.Count);

        var used = await PostAsync(Anonymous, "/api/auth/password-reset/confirm",
            new PasswordResetConfirm(tokens[1], "Br4ndNewPassword!"));
        Assert.Equal(HttpStatusCode.NoContent, used.StatusCode);

        var stale = await PostAsync(Anonymous, "/api/auth/password-reset/confirm",
            new PasswordResetConfirm(tokens[0], "YetAn0therPassword!"));
        Assert.Equal(HttpStatusCode.Unauthorized, stale.StatusCode);
    }

    [Fact]
    public async Task Password_reset_for_an_unknown_address_says_nothing()
    {
        var response = await PostAsync(Anonymous, "/api/auth/password-reset/request",
            new PasswordResetRequest(UniqueEmail("ghost")));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(Api.Emails.Sent);
    }

    private static string ExtractResetToken(string html)
    {
        var match = Regex.Match(html, @"reset-password\?token=([^""<]+)");
        Assert.True(match.Success, "The reset mail did not contain a token link.");
        return Uri.UnescapeDataString(match.Groups[1].Value);
    }
}
