namespace OpenQuiz.Domain.Enums;

/// <summary>
/// Which branch of <c>PlanResolver</c> produced a <c>BillingAccount</c>'s plan,
/// kept for support/audit purposes ("why is this account on this plan?").
/// </summary>
public enum PlanSource : byte
{
    /// <summary>Fell back to <c>Billing:DefaultPlanCode</c> — no account, no license.</summary>
    Default = 1,

    /// <summary>Grandfathered in under <c>Billing:LegacyCutoffUtc</c>.</summary>
    Legacy = 2,

    /// <summary>Set by an admin through the manual plan-change endpoint.</summary>
    Manual = 3,

    /// <summary>Synced from a payment provider subscription.</summary>
    Provider = 4,

    /// <summary>Granted by a signed self-hosted license key.</summary>
    License = 5
}
