namespace OpenQuiz.Application.Billing;

/// <summary>
/// Named entitlements, mirroring how <c>RateLimitPolicies</c> names rate-limit
/// buckets. Every key resolves to a single <see cref="long"/> in one
/// dictionary — feature flags are stored as 0/1, limits use -1 for unlimited.
/// This keeps <c>EntitlementOverride</c> a uniform (Key, Value) row and makes
/// serialising the whole set to the frontend trivial.
/// </summary>
public static class EntitlementKeys
{
    // Features (0 = locked, 1 = unlocked)
    public const string ReportsExport = "reports.export";
    public const string ReportsAdvanced = "reports.advanced";
    public const string BrandingCustom = "branding.custom";
    public const string ContentExam = "content.exam";
    public const string ContentWordCloud = "content.wordcloud";
    public const string ContentKatex = "content.katex";

    // Limits (integer; -1 = unlimited)
    public const string LimitActivePolls = "limits.activePolls";
    public const string LimitParticipantsPerSession = "limits.participantsPerSession";
    public const string LimitSessionsPerMonth = "limits.sessionsPerMonth";
    public const string LimitQuestionsPerPoll = "limits.questionsPerPoll";

    /// <summary>Sentinel stored as a limit's value to mean "no cap".</summary>
    public const long Unlimited = -1;
}
