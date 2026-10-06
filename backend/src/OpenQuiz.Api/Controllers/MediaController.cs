using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Api.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Media;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/media")]
public class MediaController : ControllerBase
{
    private readonly IMediaService _media;
    public MediaController(IMediaService media) => _media = media;

    [Authorize]
    [HttpPost]
    [RequestSizeLimit(2_500_000)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<MediaFileDto>> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest();
        await using var stream = file.OpenReadStream();
        return Ok(await _media.UploadAsync(stream, file.ContentType ?? "", file.FileName, ct));
    }

    /// <summary>Anonymous on purpose: voter screens show question images with no account.</summary>
    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var opened = await _media.OpenAsync(id, ct);
        if (opened is null) return NotFound();
        return File(opened.Value.Stream, opened.Value.ContentType, enableRangeProcessing: false);
    }
}
