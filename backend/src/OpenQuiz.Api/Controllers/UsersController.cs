using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Users;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;
    public UsersController(IUserService users) => _users = users;

    [HttpGet("authorized")]
    public async Task<ActionResult<List<AuthorizedUserDto>>> ListAuthorized(CancellationToken ct)
        => Ok(await _users.ListAuthorizedAsync(ct));

    [HttpPost("authorized")]
    public async Task<IActionResult> AddAuthorized([FromBody] AddAuthorizedUserRequest req, CancellationToken ct)
    {
        await _users.AddAuthorizedAsync(req, ct);
        return Created($"/api/users/authorized/{req.Email}", null);
    }

    [HttpDelete("authorized/{email}")]
    public async Task<IActionResult> RemoveAuthorized(string email, CancellationToken ct)
    {
        await _users.RemoveAuthorizedAsync(email, ct);
        return NoContent();
    }

    [HttpGet("registered")]
    public async Task<ActionResult<List<RegisteredUserDto>>> ListRegistered(CancellationToken ct)
        => Ok(await _users.ListRegisteredAsync(ct));
}
