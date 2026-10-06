namespace OpenQuiz.Application.Billing;

public static class WebhookEventTypes
{
    public const string SubscriptionCreated = "subscription.created";
    public const string SubscriptionUpdated = "subscription.updated";
    public const string SubscriptionCanceled = "subscription.canceled";
    public const string InvoicePaid = "invoice.paid";
    public const string InvoiceFailed = "invoice.failed";
}

public static class CheckoutIntervals
{
    public const string Monthly = "monthly";
    public const string Yearly = "yearly";

    public static bool IsKnown(string? interval) =>
        string.Equals(interval, Monthly, StringComparison.OrdinalIgnoreCase)
        || string.Equals(interval, Yearly, StringComparison.OrdinalIgnoreCase);
}

public record CheckoutRequest(
    Guid UserId,
    Guid BillingAccountId,
    string PlanCode,
    string Interval,
    string SuccessUrl,
    string CancelUrl,
    string? ProviderPriceId,
    string? ProviderCustomerId);

public record CheckoutSession(string Url, string? ProviderSessionId);

public record ProviderSubscription(
    string Id,
    string Status,
    string? ProviderCustomerId,
    DateTime? CurrentPeriodEnd);

/// <summary>
/// Provider-agnostic webhook after signature verification. Amount and plan
/// code on the payload are informational — plan changes go through
/// <c>BillingOptions.Prices</c> keyed by <see cref="ProviderPriceId"/>.
/// </summary>
public sealed class WebhookEvent
{
    public required string EventId { get; init; }
    public required string Type { get; init; }
    public string? ProviderSubscriptionId { get; init; }
    public string? ProviderCustomerId { get; init; }
    public string? ProviderPaymentId { get; init; }
    public string? ProviderPriceId { get; init; }

    /// <summary>Our user id, sent as checkout metadata and echoed back signed.</summary>
    public string? ClientReferenceId { get; init; }

    public decimal? Amount { get; init; }
    public string? Currency { get; init; }
    public DateTime? CurrentPeriodStart { get; init; }
    public DateTime? CurrentPeriodEnd { get; init; }
    public bool CancelAtPeriodEnd { get; init; }
}

public enum WebhookHandleResult
{
    Ok,
    InvalidSignature,
    UnknownProvider
}
