using OpenQuiz.Application.Billing;

namespace OpenQuiz.Application.Abstractions;

public interface IPaymentWebhookService
{
    /// <summary>
    /// Insert-first idempotency, then apply. Throws on a transient failure so
    /// the controller can answer 500 and the provider will retry.
    /// </summary>
    Task<WebhookHandleResult> HandleAsync(
        string providerKey,
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken ct);
}
