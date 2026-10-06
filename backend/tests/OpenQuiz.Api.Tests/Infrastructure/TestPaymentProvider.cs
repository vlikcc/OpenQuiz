using System.Text.Json;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;

namespace OpenQuiz.Api.Tests.Infrastructure;

/// <summary>
/// In-process stand-in so webhook tests can exercise the controller without
/// shipping a real provider. A matching <c>X-Test-Signature: ok</c> header
/// is the entire authenticity check.
/// </summary>
public sealed class TestPaymentProvider : IPaymentProvider
{
    public const string SignatureHeader = "X-Test-Signature";
    public const string ValidSignature = "ok";

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public string Key => "test";
    public bool IsConfigured => true;

    public Task<CheckoutSession> CreateCheckoutAsync(CheckoutRequest req, CancellationToken ct) =>
        Task.FromResult(new CheckoutSession($"https://pay.test/checkout?plan={Uri.EscapeDataString(req.PlanCode)}", "sess_test"));

    public Task<ProviderSubscription?> GetSubscriptionAsync(string providerSubscriptionId, CancellationToken ct) =>
        Task.FromResult<ProviderSubscription?>(null);

    public Task CancelAsync(string providerSubscriptionId, bool atPeriodEnd, CancellationToken ct) =>
        Task.CompletedTask;

    public Task<WebhookEvent?> ParseWebhookAsync(
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken ct)
    {
        if (!headers.TryGetValue(SignatureHeader, out var signature)
            || !string.Equals(signature, ValidSignature, StringComparison.Ordinal))
            return Task.FromResult<WebhookEvent?>(null);

        try
        {
            return Task.FromResult(JsonSerializer.Deserialize<WebhookEvent>(rawBody.Span, Json));
        }
        catch (JsonException)
        {
            return Task.FromResult<WebhookEvent?>(null);
        }
    }
}
