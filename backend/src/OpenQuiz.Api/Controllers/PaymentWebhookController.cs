using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;

namespace OpenQuiz.Api.Controllers;

/// <summary>
/// Provider callbacks. Anonymous and un-rate-limited on purpose: the
/// authenticity check is the provider's signature, not a JWT, and a global
/// limiter would 429 a retry storm into lost payments. The body is read as
/// raw bytes — <c>[FromBody]</c> would reserialize and break the signature.
/// </summary>
[ApiController]
[AllowAnonymous]
[DisableRateLimiting]
[Route("api/billing/webhooks/{provider}")]
public class PaymentWebhookController : ControllerBase
{
    public const int MaxBodyBytes = 256 * 1024;

    private readonly IPaymentWebhookService _webhooks;
    public PaymentWebhookController(IPaymentWebhookService webhooks) => _webhooks = webhooks;

    [HttpPost]
    public async Task<IActionResult> Post(string provider, CancellationToken ct)
    {
        if (Request.ContentLength > MaxBodyBytes)
            return StatusCode(StatusCodes.Status413PayloadTooLarge);

        var body = await ReadCappedAsync(Request.Body, MaxBodyBytes, ct);
        if (body is null)
            return StatusCode(StatusCodes.Status413PayloadTooLarge);

        var headers = Request.Headers.ToDictionary(
            h => h.Key,
            h => h.Value.ToString(),
            StringComparer.OrdinalIgnoreCase);

        var result = await _webhooks.HandleAsync(provider, body, headers, ct);
        return result switch
        {
            WebhookHandleResult.UnknownProvider => NotFound(),
            WebhookHandleResult.InvalidSignature => BadRequest(),
            _ => Ok()
        };
    }

    private static async Task<byte[]?> ReadCappedAsync(Stream stream, int max, CancellationToken ct)
    {
        using var ms = new MemoryStream(Math.Min(max, 4096));
        var buffer = new byte[8192];
        var total = 0;
        while (true)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), ct);
            if (read == 0) break;
            total += read;
            if (total > max) return null;
            ms.Write(buffer, 0, read);
        }

        return ms.ToArray();
    }
}
