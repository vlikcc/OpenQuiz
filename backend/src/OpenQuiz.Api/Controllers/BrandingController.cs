using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Api.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Branding;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/branding")]
public class BrandingController : ControllerBase
{
    private readonly IBrandingService _branding;
    public BrandingController(IBrandingService branding) => _branding = branding;

    [Authorize]
    [HttpGet]
    public async Task<ActionResult<BrandingDto>> Get(CancellationToken ct)
        => Ok(await _branding.GetMineAsync(ct));

    [Authorize]
    [HttpPut]
    public async Task<ActionResult<BrandingDto>> Put([FromBody] UpdateBrandingRequest req, CancellationToken ct)
        => Ok(await _branding.UpdateMineAsync(req, ct));

    /// <summary>Anonymous on purpose: the voter join screen has no account.</summary>
    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("/api/polls/{pollId:guid}/branding")]
    public async Task<ActionResult<BrandingDto>> GetForPoll(Guid pollId, CancellationToken ct)
        => Ok(await _branding.GetForPollAsync(pollId, ct));
}
