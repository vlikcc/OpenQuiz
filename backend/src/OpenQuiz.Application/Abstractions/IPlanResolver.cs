using OpenQuiz.Application.Billing;

namespace OpenQuiz.Application.Abstractions;

/// <summary>
/// Resolves which plan a user is on, trying each source in order: an active
/// self-hosted license (instance-wide), a <c>BillingAccount</c> row when
/// billing is enabled, a legacy grandfathering cutoff, and finally the
/// deployment's default plan. Cloud and self-hosted differ only in which
/// branch fires — every caller downstream goes through the same
/// <see cref="ResolvedPlan"/> shape.
/// </summary>
public interface IPlanResolver
{
    Task<ResolvedPlan> ForUserAsync(Guid userId, CancellationToken ct);
}
