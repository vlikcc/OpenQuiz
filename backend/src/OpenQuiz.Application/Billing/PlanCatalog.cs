namespace OpenQuiz.Application.Billing;

/// <summary>
/// The plan catalog lives in code, not the database. Two reasons drove this:
/// a self-hosted install must behave correctly against an empty database, so
/// a seed migration every fork has to carry (and could silently delete) is
/// the wrong shape; and limits are business logic that wants unit tests with
/// no SQL fixture, not editable rows. The only genuinely environment-specific
/// part — prices — lives in <c>BillingOptions</c> instead, matching how
/// <c>SmtpOptions</c>/<c>JwtOptions</c> hold this deployment's environment
/// values while the *behaviour* stays in code.
///
/// <see cref="BillingAccountPlanCode"/>-shaped strings are looked up here with
/// no foreign key, so a plan can be retired in code without orphaning rows —
/// an unknown code falls back to <c>Billing:DefaultPlanCode</c>.
/// </summary>
public static class PlanCatalog
{
    public const string Free = "free";
    public const string Pro = "pro";
    public const string Team = "team";
    public const string SelfHostedPro = "selfhosted_pro";

    /// <summary>
    /// All limits removed, all features on. This is what a self-hosted install
    /// runs on by default (<c>Billing:DefaultPlanCode</c> when billing is
    /// disabled), so `docker compose up` behaves exactly like the product did
    /// before this feature existed.
    /// </summary>
    public const string Unlimited = "unlimited";

    private static readonly IReadOnlyDictionary<string, long> FreeValues = new Dictionary<string, long>
    {
        [EntitlementKeys.LimitActivePolls] = 1,
        [EntitlementKeys.LimitParticipantsPerSession] = 30,
        [EntitlementKeys.LimitSessionsPerMonth] = 5,
        [EntitlementKeys.LimitQuestionsPerPoll] = 15,
        [EntitlementKeys.ReportsExport] = 0,
        [EntitlementKeys.ReportsAdvanced] = 0,
        [EntitlementKeys.BrandingCustom] = 0,
        [EntitlementKeys.ContentExam] = 0,
        [EntitlementKeys.ContentWordCloud] = 0,
        [EntitlementKeys.ContentKatex] = 1,
    };

    private static readonly IReadOnlyDictionary<string, long> ProValues = new Dictionary<string, long>
    {
        [EntitlementKeys.LimitActivePolls] = 10,
        [EntitlementKeys.LimitParticipantsPerSession] = 250,
        [EntitlementKeys.LimitSessionsPerMonth] = 100,
        [EntitlementKeys.LimitQuestionsPerPoll] = 100,
        [EntitlementKeys.ReportsExport] = 1,
        [EntitlementKeys.ReportsAdvanced] = 1,
        [EntitlementKeys.BrandingCustom] = 1,
        [EntitlementKeys.ContentExam] = 1,
        [EntitlementKeys.ContentWordCloud] = 1,
        [EntitlementKeys.ContentKatex] = 1,
    };

    private static readonly IReadOnlyDictionary<string, long> TeamValues = new Dictionary<string, long>
    {
        [EntitlementKeys.LimitActivePolls] = EntitlementKeys.Unlimited,
        [EntitlementKeys.LimitParticipantsPerSession] = 1000,
        [EntitlementKeys.LimitSessionsPerMonth] = EntitlementKeys.Unlimited,
        [EntitlementKeys.LimitQuestionsPerPoll] = 300,
        [EntitlementKeys.ReportsExport] = 1,
        [EntitlementKeys.ReportsAdvanced] = 1,
        [EntitlementKeys.BrandingCustom] = 1,
        [EntitlementKeys.ContentExam] = 1,
        [EntitlementKeys.ContentWordCloud] = 1,
        [EntitlementKeys.ContentKatex] = 1,
    };

    private static readonly IReadOnlyDictionary<string, long> UnlimitedValues =
        new Dictionary<string, long>
        {
            [EntitlementKeys.LimitActivePolls] = EntitlementKeys.Unlimited,
            [EntitlementKeys.LimitParticipantsPerSession] = EntitlementKeys.Unlimited,
            [EntitlementKeys.LimitSessionsPerMonth] = EntitlementKeys.Unlimited,
            [EntitlementKeys.LimitQuestionsPerPoll] = EntitlementKeys.Unlimited,
            [EntitlementKeys.ReportsExport] = 1,
            [EntitlementKeys.ReportsAdvanced] = 1,
            [EntitlementKeys.BrandingCustom] = 1,
            [EntitlementKeys.ContentExam] = 1,
            [EntitlementKeys.ContentWordCloud] = 1,
            [EntitlementKeys.ContentKatex] = 1,
        };

    private static readonly IReadOnlyDictionary<string, PlanDefinition> Plans =
        new Dictionary<string, PlanDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            [Free] = new PlanDefinition(Free, FreeValues),
            [Pro] = new PlanDefinition(Pro, ProValues),
            [Team] = new PlanDefinition(Team, TeamValues),
            // A self-hosted license grants this plan; it behaves like the
            // unlimited default because the operator already owns the hardware.
            [SelfHostedPro] = new PlanDefinition(SelfHostedPro, UnlimitedValues),
            [Unlimited] = new PlanDefinition(Unlimited, UnlimitedValues),
        };

    public static bool TryGet(string? planCode, out PlanDefinition plan)
    {
        if (planCode is not null && Plans.TryGetValue(planCode, out var found))
        {
            plan = found;
            return true;
        }

        plan = Plans[Unlimited];
        return false;
    }

    public static IReadOnlyCollection<PlanDefinition> All => (IReadOnlyCollection<PlanDefinition>)Plans.Values;

    /// <summary>
    /// Plans a customer can actually buy. Free is the default, unlimited and
    /// selfhosted_pro are grants — none of those belong on a checkout form.
    /// </summary>
    public static bool IsPurchasable(string? planCode) =>
        planCode is not null
        && (planCode.Equals(Pro, StringComparison.OrdinalIgnoreCase)
            || planCode.Equals(Team, StringComparison.OrdinalIgnoreCase));
}
