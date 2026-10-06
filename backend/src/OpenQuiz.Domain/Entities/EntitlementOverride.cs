namespace OpenQuiz.Domain.Entities;

/// <summary>
/// A per-account deviation from the plan catalog — an admin raising or
/// lowering a single limit or feature flag without minting a new plan code.
/// Composed on top of the plan (and any license grants) as the last, highest
/// priority layer; see <c>EntitlementService</c>.
/// </summary>
public class EntitlementOverride
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BillingAccountId { get; set; }
    public BillingAccount BillingAccount { get; set; } = null!;

    /// <summary>One of the <c>EntitlementKeys</c> constants.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Booleans are stored as 0/1; -1 means unlimited for a limit key.</summary>
    public long Value { get; set; }

    public DateTime? ExpiresAt { get; set; }
    public string? Reason { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
