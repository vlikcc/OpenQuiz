using Microsoft.AspNetCore.Mvc;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InfoController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        name = "OpenQuiz API",
        version = "1.0.0",
        phase = "session-product"
    });
}
