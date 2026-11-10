using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using OpenQuiz.Infrastructure.Options;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InfoController(IOptions<AppOptions> app) : ControllerBase
{
    /// <summary>
    /// <c>publicUrl</c> lets a presenter browsing on localhost still hand out a
    /// join QR that phones in the room can open.
    /// </summary>
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        name = "OpenQuiz API",
        version = "1.0.0",
        phase = "session-product",
        publicUrl = app.Value.PublicUrl,
    });
}
