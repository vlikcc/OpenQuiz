namespace OpenQuiz.Infrastructure.Services;

/// <summary>
/// The cache key <c>PollService.JoinAsync</c> uses to look up a poll's
/// participant cap without a plan lookup on every join, and that
/// <c>BillingService</c> evicts when an admin changes a user's plan by hand.
/// Centralised so the two call sites can never drift apart.
/// </summary>
internal static class PollCapCache
{
    public static string Key(Guid pollId) => $"poll-cap:{pollId}";
}
