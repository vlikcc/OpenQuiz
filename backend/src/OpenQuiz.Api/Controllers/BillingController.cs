using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;

namespace OpenQuiz.Api.Controllers;

[ApiController]
[Route("api/billing")]
public class BillingController : ControllerBase
{
    private readonly IBillingService _billing;
    public BillingController(IBillingService billing) => _billing = billing;

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<BillingMeDto>> Me(CancellationToken ct)
        => Ok(await _billing.GetMeAsync(ct));

    /// <summary>Anonymous on purpose: a pricing page needs this before sign-in.</summary>
    [HttpGet("plans")]
    public async Task<ActionResult<List<PlanSummaryDto>>> Plans(CancellationToken ct)
        => Ok(await _billing.ListPlansAsync(ct));

    [Authorize]
    [HttpPut("accounts/{userId:guid}/plan")]
    public async Task<IActionResult> SetAccountPlan(Guid userId, [FromBody] SetAccountPlanRequest req, CancellationToken ct)
    {
        await _billing.SetAccountPlanAsync(userId, req.PlanCode, ct);
        return NoContent();
    }

    [Authorize]
    [HttpPost("checkout")]
    public async Task<ActionResult<CheckoutSessionDto>> Checkout([FromBody] CreateCheckoutApiRequest req, CancellationToken ct)
        => Ok(await _billing.CreateCheckoutAsync(req, ct));

    [Authorize]
    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel([FromBody] CancelSubscriptionRequest req, CancellationToken ct)
    {
        await _billing.CancelMineAsync(req, ct);
        return NoContent();
    }
}
