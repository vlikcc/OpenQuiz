using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Scores;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class ScoreService : IScoreService
{
    /// <summary>
    /// How much of a poll's standings an anonymous (or non-owner) caller may
    /// pull. The presenter and voter screens only show ~10, so 20 leaves a
    /// little room without handing a scraper the full named roster.
    /// </summary>
    public const int PublicTop = 20;

    /// <summary>Ceiling for the owner/admin path and the <c>top</c> query param.</summary>
    public const int OwnerTop = 500;

    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;

    public ScoreService(OpenQuizDbContext db, ICurrentUser user)
    {
        _db = db;
        _user = user;
    }

    public async Task<List<ScoreEntry>> LeaderboardAsync(Guid? pollId, int top, CancellationToken ct)
    {
        var take = Math.Clamp(top, 1, await MaxTopAsync(pollId, ct));

        var q = _db.Scores.AsNoTracking();
        q = pollId.HasValue ? q.Where(s => s.PollId == pollId) : q.Where(s => s.PollId == null);

        return await q.OrderByDescending(s => s.Points).ThenBy(s => s.TotalTimeMs)
            .Take(take)
            .Select(s => new ScoreEntry(s.UserName, s.Points, s.TotalTimeMs))
            .ToListAsync(ct);
    }

    private async Task<int> MaxTopAsync(Guid? pollId, CancellationToken ct)
    {
        if (_user.IsAdmin) return OwnerTop;
        if (pollId is Guid id && _user.UserId is Guid uid)
        {
            var creatorId = await _db.Polls.AsNoTracking()
                .Where(p => p.Id == id)
                .Select(p => (Guid?)p.CreatorId)
                .FirstOrDefaultAsync(ct);
            if (creatorId == uid) return OwnerTop;
        }

        return PublicTop;
    }
}
