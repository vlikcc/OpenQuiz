using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Scores;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/scores")]
public class ScoresController : ControllerBase
{
    private readonly IScoreService _scores;
    public ScoresController(IScoreService scores) => _scores = scores;

    [HttpGet]
    public async Task<ActionResult<List<ScoreEntry>>> Leaderboard(
        [FromQuery] Guid? pollId,
        [FromQuery] int top = 100,
        CancellationToken ct = default)
        => Ok(await _scores.LeaderboardAsync(pollId, top, ct));
}
