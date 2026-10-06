using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Infrastructure.Options;

namespace OpenQuiz.Infrastructure.Payments;

/// <summary>
/// The only registered provider, and it stays that way until a Merchant of
/// Record is chosen. There is no card form: checkout is a contact URL the
/// operator fulfils by flipping the plan through
/// <c>PUT /api/billing/accounts/{id}/plan</c>. Webhooks are not a thing here,
/// so <see cref="ParseWebhookAsync"/> always returns null (treated as a bad
/// signature — there is nothing authentic to accept).
/// </summary>
public class ManualPaymentProvider : IPaymentProvider
{
    private readonly BillingOptions _billing;
    private readonly AppOptions _app;

    public ManualPaymentProvider(IOptions<BillingOptions> billing, IOptions<AppOptions> app)
    {
        _billing = billing.Value;
        _app = app.Value;
    }

    public string Key => "manual";
    public bool IsConfigured => true;

    public Task<CheckoutSession> CreateCheckoutAsync(CheckoutRequest req, CancellationToken ct)
    {
        var url = ContactUrl(req.PlanCode);
        return Task.FromResult(new CheckoutSession(url, null));
    }

    public Task<ProviderSubscription?> GetSubscriptionAsync(string providerSubscriptionId, CancellationToken ct) =>
        Task.FromResult<ProviderSubscription?>(null);

    public Task CancelAsync(string providerSubscriptionId, bool atPeriodEnd, CancellationToken ct) =>
        Task.CompletedTask;

    public Task<WebhookEvent?> ParseWebhookAsync(
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken ct) =>
        Task.FromResult<WebhookEvent?>(null);

    private string ContactUrl(string planCode)
    {
        if (!string.IsNullOrWhiteSpace(_billing.CheckoutReturnUrl))
        {
            var sep = _billing.CheckoutReturnUrl.Contains('?') ? '&' : '?';
            return $"{_billing.CheckoutReturnUrl}{sep}plan={Uri.EscapeDataString(planCode)}";
        }

        var origin = string.IsNullOrWhiteSpace(_app.PublicUrl) ? "http://localhost:5173" : _app.PublicUrl.TrimEnd('/');
        return $"{origin}/?billing=contact&plan={Uri.EscapeDataString(planCode)}";
    }
}
