using Microsoft.EntityFrameworkCore;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

internal static class ScoreLedger
{
    /// <summary>
    /// Adds to a running total, so two answers scored at the same moment do not
    /// overwrite each other.
    /// </summary>
    public static Task AccumulateAsync(
        OpenQuizDbContext db, Guid pollId, string userName, int points, long elapsedMs, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        return ConcurrentCounters.IncrementOrCreateAsync(
            token => db.Scores
                .Where(s => s.PollId == pollId && s.UserName == userName)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(s => s.Points, s => s.Points + points)
                    .SetProperty(s => s.TotalTimeMs, s => s.TotalTimeMs + elapsedMs)
                    .SetProperty(s => s.UpdatedAt, now), token),
            async token =>
            {
                db.Scores.Add(new Score
                {
                    PollId = pollId,
                    UserName = userName,
                    Points = points,
                    TotalTimeMs = elapsedMs,
                    UpdatedAt = now
                });
                await db.SaveChangesAsync(token);
            },
            ct);
    }
}

internal static class VoterKeys
{
    // Signed-in voters are deduplicated on their account, anonymous ones on the
    // name they joined under, which is the only identity they have.
    public static string For(Guid? userId, string userName) =>
        userId is Guid uid
            ? $"user:{uid}"
            : $"anon:{userName.Trim().ToLowerInvariant()}";
}
