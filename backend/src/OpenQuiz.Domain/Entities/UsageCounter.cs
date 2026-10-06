namespace OpenQuiz.Domain.Entities;

/// <summary>
/// A monotonic count for one metric within one billing period. The period
/// rollover needs no scheduled job: a new period is simply a new
/// <see cref="PeriodKey"/>, and a missing row reads as zero — see
/// <c>UsagePeriod.KeyFor</c>. Written through <c>ConcurrentCounters.IncrementOrCreateAsync</c>,
/// the same pattern <c>WordCloudAggregate</c> uses for concurrent bumps.
/// </summary>
public class UsageCounter
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BillingAccountId { get; set; }
    public BillingAccount BillingAccount { get; set; } = null!;

    /// <summary>E.g. "sessions" — the number of times a poll was activated this period.</summary>
    public string Metric { get; set; } = string.Empty;

    /// <summary>"yyyy-MM" for a calendar month, or "yyyy-MM-dd" anchored to a subscription's period start.</summary>
    public string PeriodKey { get; set; } = string.Empty;

    public int Value { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
