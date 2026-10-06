using OpenQuiz.Application.Billing;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Pure unit tests, deliberately outside <see cref="DatabaseCollection"/> —
/// <see cref="UsagePeriod.KeyFor"/> takes no dependency on the database or the
/// clock, so proving the monthly rollover works needs no fixture at all.
/// </summary>
public class UsagePeriodTests
{
    [Fact]
    public void No_subscription_anchor_keys_by_calendar_month()
    {
        var key = UsagePeriod.KeyFor(periodStart: null, utcNow: new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc));

        Assert.Equal("2026-08", key);
    }

    [Fact]
    public void A_new_calendar_month_produces_a_different_key()
    {
        var august = UsagePeriod.KeyFor(null, new DateTime(2026, 8, 31, 23, 59, 0, DateTimeKind.Utc));
        var september = UsagePeriod.KeyFor(null, new DateTime(2026, 9, 1, 0, 0, 1, DateTimeKind.Utc));

        Assert.NotEqual(august, september);
    }

    [Fact]
    public void A_subscription_anchor_keys_by_its_own_date_regardless_of_the_current_month()
    {
        var anchor = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);

        var key = UsagePeriod.KeyFor(anchor, utcNow: new DateTime(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc));

        Assert.Equal("2026-03-15", key);
    }

    [Fact]
    public void Upgrading_mid_period_changes_the_anchor_and_therefore_resets_usage()
    {
        var beforeUpgrade = UsagePeriod.KeyFor(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), DateTime.UtcNow);
        var afterUpgrade = UsagePeriod.KeyFor(new DateTime(2026, 8, 24, 0, 0, 0, DateTimeKind.Utc), DateTime.UtcNow);

        // Different anchor -> different key -> a fresh UsageCounter row, i.e.
        // usage resets. That is intended (the customer just paid for a new
        // period), not a bug — see UsagePeriod's own doc comment.
        Assert.NotEqual(beforeUpgrade, afterUpgrade);
    }
}
