using OpenQuiz.Application.Scores;

namespace OpenQuiz.Application.Abstractions;

public interface IScoreService
{
    Task<List<ScoreEntry>> LeaderboardAsync(Guid? pollId, int top, CancellationToken ct);
}
