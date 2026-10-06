using OpenQuiz.Application.Billing;

namespace OpenQuiz.Application.Abstractions;

/// <summary>
/// One payment backend. Today that is <c>manual</c> (contact / wire, an admin
/// flips the plan). When cards exist, the implementation will be a
/// <strong>Merchant of Record</strong> — the vendor is the seller and handles
/// VAT and invoices — not a payment gateway (we would remain the merchant
/// and inherit every country's tax filing). No MoR is registered yet.
/// Signature verification lives <em>inside</em> the provider so the webhook
/// controller never contains provider-specific code.
/// </summary>
public interface IPaymentProvider
{
    string Key { get; }
    bool IsConfigured { get; }

    Task<CheckoutSession> CreateCheckoutAsync(CheckoutRequest req, CancellationToken ct);
    Task<ProviderSubscription?> GetSubscriptionAsync(string providerSubscriptionId, CancellationToken ct);
    Task CancelAsync(string providerSubscriptionId, bool atPeriodEnd, CancellationToken ct);

    /// <summary>
    /// <c>null</c> means the payload was not authentic — the controller
    /// answers 400 without saying why, so a forged request cannot probe the
    /// verifier.
    /// </summary>
    Task<WebhookEvent?> ParseWebhookAsync(
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken ct);
}
