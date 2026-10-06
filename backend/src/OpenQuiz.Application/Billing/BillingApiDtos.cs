namespace OpenQuiz.Application.Billing;

public record PlanPricingDto(decimal? Monthly, decimal? Yearly, string Currency);

/// <summary>What the (anonymous-readable) pricing page needs for one plan.</summary>
public record PlanSummaryDto(
    string Code,
    IReadOnlyDictionary<string, long> Values,
    PlanPricingDto? Pricing);

/// <summary>
/// The signed-in caller's full billing picture. <see cref="Usage"/> is keyed
/// by the same limit keys as <see cref="Values"/> — e.g. both carry
/// <c>limits.sessionsPerMonth</c> — so the frontend can render a "3 of 5"
/// progress bar with one lookup on each side.
/// </summary>
public record BillingMeDto(
    string PlanCode,
    string Source,
    string Status,
    DateTime? CurrentPeriodEnd,
    IReadOnlyDictionary<string, long> Values,
    IReadOnlyDictionary<string, long> Usage);

public record SetAccountPlanRequest(string PlanCode);

public record CreateCheckoutApiRequest(string PlanCode, string Interval);

public record CheckoutSessionDto(string Url, string? ProviderSessionId);

public record CancelSubscriptionRequest(bool AtPeriodEnd);
