namespace OpenQuiz.Infrastructure.Options;

public class PlanPricing
{
    public decimal? Monthly { get; set; }
    public decimal? Yearly { get; set; }
    public string? ProviderPriceId { get; set; }
    public string? ProviderPriceIdYearly { get; set; }
}

/// <summary>
/// Master switch and defaults for the entitlement engine. The defaults below
/// (<see cref="Enabled"/> = false, <see cref="DefaultPlanCode"/> = unlimited)
/// are what make shipping this feature safe: every self-hosted install that
/// doesn't opt in sees zero behavioural change. A hosted deployment sets
/// <c>Billing__Enabled=true</c> and <c>Billing__DefaultPlanCode=free</c>.
///
/// Commercial model, when card checkout ships: Merchant of Record. Until a
/// vendor is chosen, <see cref="Provider"/> stays <c>manual</c> and there is
/// no payment SDK in this solution.
/// </summary>
public class BillingOptions
{
    public const string SectionName = "Billing";

    public bool Enabled { get; set; }

    /// <summary>
    /// Checkout backend key. <c>manual</c> is the only registered
    /// implementation. A future value will be a Merchant of Record's key
    /// (Paddle / Lemon Squeezy / FastSpring class), not a payment gateway.
    /// </summary>
    public string Provider { get; set; } = "manual";
    public string DefaultPlanCode { get; set; } = "unlimited";

    /// <summary>Grandfathering: users created before <see cref="LegacyCutoffUtc"/> resolve to this plan instead of the default.</summary>
    public string? LegacyPlanCode { get; set; }
    public DateTime? LegacyCutoffUtc { get; set; }

    public string Currency { get; set; } = "TRY";
    public string? CheckoutReturnUrl { get; set; }
    public string? WebhookSecret { get; set; }

    public Dictionary<string, PlanPricing> Prices { get; set; } = new();

    public int PlanCacheSeconds { get; set; } = 60;

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(Provider);
}
