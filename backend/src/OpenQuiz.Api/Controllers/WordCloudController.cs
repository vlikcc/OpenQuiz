using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Api.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/polls/{pollId:guid}/wordcloud")]
public class WordCloudController : ControllerBase
{
    private readonly IWordCloudService _service;
    public WordCloudController(IWordCloudService service) => _service = service;

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpPost("submit")]
    public async Task<ActionResult<WordCloudResponse>> Submit(Guid pollId, [FromBody] WordCloudSubmitRequest req, CancellationToken ct)
        => Ok(await _service.SubmitAsync(pollId, req, ct));

    [EnableRateLimiting(RateLimitPolicies.Participation)]
    [HttpGet("{questionIndex:int}")]
    public async Task<ActionResult<WordCloudResponse>> Get(Guid pollId, int questionIndex, [FromQuery] int? topN = null, CancellationToken ct = default)
        => Ok(await _service.GetAsync(pollId, questionIndex, topN, ct));
}
