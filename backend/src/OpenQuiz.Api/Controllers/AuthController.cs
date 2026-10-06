using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Api.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Auth;
using OpenQuiz.Application.Common;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly ICurrentUser _current;

    public AuthController(IAuthService auth, ICurrentUser current)
    {
        _auth = auth; _current = current;
    }

    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> Google([FromBody] GoogleLoginRequest req, CancellationToken ct)
        => Ok(await _auth.GoogleLoginAsync(req, ct));

    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req, CancellationToken ct)
        => Ok(await _auth.RegisterAsync(req, ct));

    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
        => Ok(await _auth.LoginAsync(req, ct));

    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
        => Ok(await _auth.RefreshAsync(req, ct));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest req, CancellationToken ct)
    {
        await _auth.LogoutAsync(req, ct);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        if (_current.UserId is not Guid uid) throw Errors.Unauthorized();
        var me = await _auth.GetMeAsync(uid, ct);
        return me is null ? NotFound() : Ok(me);
    }

    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [HttpPost("password-reset/request")]
    public async Task<IActionResult> ResetRequest([FromBody] PasswordResetRequest req, CancellationToken ct)
    {
        await _auth.PasswordResetRequestAsync(req, ct);
        // Do not reveal existence.
        return Accepted();
    }

    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [HttpPost("password-reset/confirm")]
    public async Task<IActionResult> ResetConfirm([FromBody] PasswordResetConfirm req, CancellationToken ct)
    {
        await _auth.PasswordResetConfirmAsync(req, ct);
        return NoContent();
    }
}
