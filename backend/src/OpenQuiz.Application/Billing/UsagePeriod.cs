using System.Globalization;

namespace OpenQuiz.Application.Billing;

/// <summary>
/// Turns a billing anchor into the key <c>UsageCounter</c> rows are keyed by.
/// Monthly rollover needs no scheduled job because of this: a new period
/// produces a new key, a missing row for that key reads as zero usage, and
/// the first increment of a new period simply inserts a fresh row. Old rows
/// are left in place as a free usage history.
///
/// Pure and deterministic on purpose — no <c>DateTime.UtcNow</c> read inside —
/// so it is unit-testable without a database.
/// </summary>
public static class UsagePeriod
{
    /// <param name="periodStart">
    /// The billing account's <c>CurrentPeriodStart</c>. Null means "no
    /// subscription anchor yet" (the common case for the free tier), which
    /// falls back to the calendar month.
    /// </param>
    /// <param name="utcNow">The current UTC instant, passed in rather than read.</param>
    public static string KeyFor(DateTime? periodStart, DateTime utcNow) =>
        periodStart is { } anchor
            ? anchor.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : utcNow.ToString("yyyy-MM", CultureInfo.InvariantCulture);
}
