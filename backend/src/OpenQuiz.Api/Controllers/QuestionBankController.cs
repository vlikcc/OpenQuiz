using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.QuestionBank;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/question-bank")]
public class QuestionBankController : ControllerBase
{
    private readonly IQuestionBankService _bank;
    public QuestionBankController(IQuestionBankService bank) => _bank = bank;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<QuestionBankItemDto>>> List(CancellationToken ct)
        => Ok(await _bank.ListMineAsync(ct));

    [HttpPost]
    public async Task<ActionResult<QuestionBankItemDto>> Create([FromBody] SaveQuestionBankItemRequest req, CancellationToken ct)
        => Ok(await _bank.CreateAsync(req, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<QuestionBankItemDto>> Update(Guid id, [FromBody] SaveQuestionBankItemRequest req, CancellationToken ct)
        => Ok(await _bank.UpdateAsync(id, req, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _bank.DeleteAsync(id, ct);
        return NoContent();
    }
}
