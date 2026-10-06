using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Application.Billing;

/// <summary>One named plan's feature flags and limits. See <see cref="PlanCatalog"/>.</summary>
public record PlanDefinition(string Code, IReadOnlyDictionary<string, long> Values);

/// <summary>
/// A resolved, fully-composed set of entitlements for one billing account:
/// plan catalog values, overlaid with license grants, overlaid with
/// <c>EntitlementOverride</c> rows. See <c>EntitlementService</c> for the
/// composition order.
/// </summary>
public class EntitlementSet
{
    public required string PlanCode { get; init; }
    public required PlanSource Source { get; init; }
    public required SubscriptionStatus Status { get; init; }
    public DateTime? CurrentPeriodEnd { get; init; }
    public required IReadOnlyDictionary<string, long> Values { get; init; }

    public bool Has(string featureKey) => Values.TryGetValue(featureKey, out var v) && v != 0;

    public long Limit(string limitKey) => Values.TryGetValue(limitKey, out var v) ? v : 0;

    public bool IsUnlimited(string limitKey) => Limit(limitKey) == EntitlementKeys.Unlimited;

    /// <summary>
    /// True when <paramref name="attemptedTotal"/> — the count *after* the
    /// action under consideration completes (one more active poll, one more
    /// session this month, this many questions on the poll being saved) —
    /// would not exceed the limit. Callers pass the resulting total, not a
    /// pre-increment count, so a cap of 15 means 15 is allowed and 16 is not.
    /// </summary>
    public bool WithinLimit(string limitKey, long attemptedTotal) =>
        IsUnlimited(limitKey) || attemptedTotal <= Limit(limitKey);
}

/// <summary>
/// Where an account's plan was resolved from, before entitlements are
/// composed. Produced by <c>IPlanResolver</c> and consumed by
/// <c>EntitlementService</c>.
/// </summary>
public record ResolvedPlan(
    Guid? BillingAccountId,
    string PlanCode,
    PlanSource Source,
    SubscriptionStatus Status,
    DateTime? CurrentPeriodStart,
    DateTime? CurrentPeriodEnd);
