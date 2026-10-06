using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Api.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Reports;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/polls")]
public class PollsController : ControllerBase
{
    private readonly IPollService _polls;
    private readonly IReportService _reports;

    public PollsController(IPollService polls, IReportService reports)
    {
        _polls = polls;
        _reports = reports;
    }

    [Authorize]
    [HttpGet]
    public async Task<ActionResult<PagedResult<PollSummaryDto>>> List([FromQuery] PageRequest paging, CancellationToken ct)
        => Ok(await _polls.ListAsync(paging, ct));

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("code/{code}")]
    public async Task<ActionResult<PollDto>> GetByCode(string code, CancellationToken ct)
    {
        var p = await _polls.GetByJoinCodeAsync(code, ct);
        return p is null ? NotFound() : Ok(p);
    }

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("shared/{token}")]
    public async Task<ActionResult<PollDto>> GetShared(string token, CancellationToken ct)
    {
        var p = await _polls.GetByShareTokenAsync(token, ct);
        return p is null ? NotFound() : Ok(p);
    }

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PollDto>> Get(Guid id, CancellationToken ct)
    {
        var p = await _polls.GetAsync(id, ct);
        return p is null ? NotFound() : Ok(p);
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<PollDto>> Create([FromBody] CreatePollRequest req, CancellationToken ct)
        => Ok(await _polls.CreateAsync(req, ct));

    [Authorize]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PollDto>> Update(Guid id, [FromBody] UpdatePollRequest req, CancellationToken ct)
        => Ok(await _polls.UpdateAsync(id, req, ct));

    [Authorize]
    [HttpPost("{id:guid}/duplicate")]
    public async Task<ActionResult<PollDto>> Duplicate(
        Guid id, [FromBody] DuplicatePollRequest? req, CancellationToken ct)
        => Ok(await _polls.DuplicateAsync(id, req ?? new DuplicatePollRequest(), ct));

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _polls.DeleteAsync(id, ct);
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:guid}/activate")]
    public async Task<ActionResult<PollDto>> Activate(Guid id, CancellationToken ct)
        => Ok(await _polls.ActivateAsync(id, ct));

    [Authorize]
    [HttpPost("{id:guid}/next-question")]
    public async Task<ActionResult<PollDto>> Next(Guid id, CancellationToken ct)
        => Ok(await _polls.NextQuestionAsync(id, ct));

    [Authorize]
    [HttpPost("{id:guid}/prev-question")]
    public async Task<ActionResult<PollDto>> Prev(Guid id, CancellationToken ct)
        => Ok(await _polls.PrevQuestionAsync(id, ct));

    [Authorize]
    [HttpPost("{id:guid}/end")]
    public async Task<ActionResult<PollDto>> End(Guid id, CancellationToken ct)
        => Ok(await _polls.EndAsync(id, ct));

    [Authorize]
    [HttpPost("{id:guid}/reset-results")]
    public async Task<ActionResult<PollDto>> ResetResults(Guid id, CancellationToken ct)
        => Ok(await _polls.ResetResultsAsync(id, ct));

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpPost("{id:guid}/join")]
    public async Task<ActionResult<PollDto>> Join(Guid id, [FromBody] JoinPollRequest req, CancellationToken ct)
        => Ok(await _polls.JoinAsync(id, req, ct));

    [Authorize]
    [HttpGet("{id:guid}/collaborators")]
    public async Task<ActionResult<IReadOnlyList<CollaboratorDto>>> Collaborators(Guid id, CancellationToken ct)
        => Ok(await _polls.ListCollaboratorsAsync(id, ct));

    [Authorize]
    [HttpPost("{id:guid}/collaborators")]
    public async Task<ActionResult<CollaboratorDto>> AddCollaborator(Guid id, [FromBody] AddCollaboratorRequest req, CancellationToken ct)
        => Ok(await _polls.AddCollaboratorAsync(id, req, ct));

    [Authorize]
    [HttpDelete("{id:guid}/collaborators/{userId:guid}")]
    public async Task<IActionResult> RemoveCollaborator(Guid id, Guid userId, CancellationToken ct)
    {
        await _polls.RemoveCollaboratorAsync(id, userId, ct);
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:guid}/results-share")]
    public async Task<ActionResult<PollDto>> EnableResultsShare(Guid id, CancellationToken ct)
        => Ok(await _polls.EnableResultsShareAsync(id, ct));

    [Authorize]
    [HttpDelete("{id:guid}/results-share")]
    public async Task<IActionResult> DisableResultsShare(Guid id, CancellationToken ct)
    {
        await _polls.DisableResultsShareAsync(id, ct);
        return NoContent();
    }

    /// <summary>
    /// Owner-only dump the export buttons fetch. Gated on <c>reports.export</c>
    /// inside the service (ownership first, so a stranger gets 403 not 402).
    /// </summary>
    [Authorize]
    [HttpGet("{id:guid}/report")]
    public async Task<ActionResult<PollReportDto>> Report(Guid id, CancellationToken ct)
        => Ok(await _reports.GetAsync(id, ct));
}
