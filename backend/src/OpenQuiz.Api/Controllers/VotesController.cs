using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Api.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Votes;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/polls/{pollId:guid}")]
public class VotesController : ControllerBase
{
    private readonly IVoteService _votes;
    public VotesController(IVoteService votes) => _votes = votes;

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpPost("votes")]
    public async Task<ActionResult<VoteDto>> Submit(Guid pollId, [FromBody] SubmitVoteRequest req, CancellationToken ct)
        => Ok(await _votes.SubmitAsync(pollId, req, ct));

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpPost("open-answers")]
    public async Task<ActionResult<OpenAnswerDto>> SubmitOpen(Guid pollId, [FromBody] SubmitOpenAnswerRequest req, CancellationToken ct)
        => Ok(await _votes.SubmitOpenAsync(pollId, req, ct));

    [Authorize]
    [HttpGet("votes")]
    public async Task<ActionResult<PagedResult<VoteDto>>> List(Guid pollId, [FromQuery] PageRequest paging, CancellationToken ct)
        => Ok(await _votes.ListAsync(pollId, paging, ct));

    [Authorize]
    [HttpGet("open-answers")]
    public async Task<ActionResult<PagedResult<OpenAnswerDto>>> ListOpen(Guid pollId, [FromQuery] PageRequest paging, CancellationToken ct)
        => Ok(await _votes.ListOpenAsync(pollId, paging, ct));

    [Authorize]
    [HttpPut("open-answers/{answerId:guid}/score")]
    public async Task<ActionResult<OpenAnswerDto>> ScoreOpen(
        Guid pollId, Guid answerId, [FromBody] ScoreOpenAnswerRequest req, CancellationToken ct)
        => Ok(await _votes.ScoreOpenAsync(pollId, answerId, req, ct));

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("aggregates")]
    public async Task<ActionResult<List<QuestionAggregate>>> Aggregates(Guid pollId, CancellationToken ct)
        => Ok(await _votes.AggregatesAsync(pollId, ct));
}
