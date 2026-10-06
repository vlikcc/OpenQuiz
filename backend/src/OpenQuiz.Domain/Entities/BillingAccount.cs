using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Domain.Entities;

/// <summary>
/// The billing subject a plan is resolved for. This indirection is what lets
/// the entitlement engine grow from per-user to per-organization billing
/// later without touching every enforcement site: today <see cref="OrganizationId"/>
/// is always null and resolution is "the account owned by this user id".
/// Once organizations exist, resolution becomes "the account for this user's
/// organization, else the account they own" — one method changes, nothing else.
/// </summary>
public class BillingAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OwnerUserId { get; set; }
    public User Owner { get; set; } = null!;

    /// <summary>
    /// Forward-compat hook for team/organization billing. Null and unindexed-by-FK
    /// on purpose — there is no Organization entity yet, and adding the column now
    /// means the eventual org rollout is a data migration, not a schema rewrite.
    /// </summary>
    public Guid? OrganizationId { get; set; }

    public string PlanCode { get; set; } = "free";
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    public PlanSource Source { get; set; } = PlanSource.Default;

    /// <summary>
    /// The billing anchor. Null means "use the calendar month" — see
    /// <c>UsagePeriod.KeyFor</c>, which is what makes usage counters roll over
    /// without a scheduled job.
    /// </summary>
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }

    public DateTime? TrialEndsAt { get; set; }
    public bool CancelAtPeriodEnd { get; set; }

    public string? ProviderKey { get; set; }
    public string? ProviderCustomerId { get; set; }
    public string? ProviderSubscriptionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Optimistic-concurrency token, mapped to PostgreSQL's <c>xmin</c> system column.</summary>
    public uint RowVersion { get; set; }

    public ICollection<EntitlementOverride> Overrides { get; set; } = new List<EntitlementOverride>();
    public ICollection<UsageCounter> UsageCounters { get; set; } = new List<UsageCounter>();
    public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();
}
