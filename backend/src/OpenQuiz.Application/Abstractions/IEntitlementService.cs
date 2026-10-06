using OpenQuiz.Application.Billing;

namespace OpenQuiz.Application.Abstractions;

/// <summary>
/// The single entry point enforcement code calls. Composes a plan's catalog
/// values with license grants and <c>EntitlementOverride</c> rows into one
/// <see cref="EntitlementSet"/>, and throws the plan-limit/plan-feature
/// <c>AppException</c> variants when a check fails.
/// </summary>
public interface IEntitlementService
{
    /// <summary>The signed-in caller's entitlements. Throws <c>Errors.Unauthorized</c> if anonymous.</summary>
    Task<EntitlementSet> ForCurrentUserAsync(CancellationToken ct);

    /// <summary>
    /// Entitlements for an arbitrary user id — for anonymous hot paths (like
    /// joining a poll) that must resolve the plan through <c>Poll.CreatorId</c>
    /// rather than the caller's own identity.
    /// </summary>
    Task<EntitlementSet> ForUserAsync(Guid userId, CancellationToken ct);

    /// <summary>Throws <c>Errors.PlanFeatureRequired</c> if the current user's plan lacks this feature.</summary>
    Task EnsureFeatureAsync(string featureKey, CancellationToken ct);

    /// <summary>
    /// Throws <c>Errors.PlanLimitExceeded</c> if <paramref name="attemptedTotal"/>
    /// — the count after the action under consideration completes — would
    /// exceed the limit. Pass the resulting total, not a pre-increment count.
    /// </summary>
    Task EnsureWithinLimitAsync(string limitKey, long attemptedTotal, CancellationToken ct);

    /// <summary>Current period's usage for a metric on the signed-in caller's billing account. Zero if unbilled or no row yet.</summary>
    Task<int> ReadUsageAsync(string metric, CancellationToken ct);

    /// <summary>Bumps a metric's current-period counter by one, creating the row on first use of a period.</summary>
    Task IncrementUsageAsync(string metric, CancellationToken ct);

    Task EnsureWithinLimitForUserAsync(Guid userId, string limitKey, long attemptedTotal, CancellationToken ct);
    Task<int> ReadUsageForUserAsync(Guid userId, string metric, CancellationToken ct);
    Task IncrementUsageForUserAsync(Guid userId, string metric, CancellationToken ct);
}
