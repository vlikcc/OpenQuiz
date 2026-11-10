using Microsoft.EntityFrameworkCore;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

/// <summary>
/// The clock of a self-paced contest. A participant's next question opens the
/// moment they finish the last one, so the timer that bounds an answer and the
/// time that breaks a tie are both theirs rather than the room's.
/// </summary>
internal static class SelfPacedContest
{
    /// <param name="ChargedMs">Time spent on questions passed since the stored row, not yet on the scoreboard.</param>
    public readonly record struct Position(int QuestionIndex, DateTime StartedAt, DateTime? FinishedAt, long ChargedMs)
    {
        public bool Finished => FinishedAt.HasValue;
    }

    public static List<Question> Ordered(Poll poll) => [.. poll.Questions.OrderBy(q => q.OrderIndex)];

    /// <summary>
    /// Walks past every question whose time ran out without an answer. Each one
    /// costs its whole limit — what a participant watching the countdown on an
    /// open phone would have spent anyway — so a phone left in a pocket cannot
    /// finish faster than one that played on.
    /// </summary>
    public static Position CatchUp(
        ParticipantProgress row, Poll poll, IReadOnlyList<Question> questions, DateTime now, TimeSpan grace)
    {
        var start = row.QuestionStartedAt ?? poll.QuestionStartedAt ?? now;
        if (row.FinishedAt is DateTime done) return new Position(row.QuestionIndex, start, done, 0);

        var index = row.QuestionIndex;
        long charged = 0;
        while (index < questions.Count)
        {
            var limit = questions[index].TimeLimit;
            if (limit <= 0) break;

            var deadline = start.AddSeconds(limit);
            if (now <= deadline + grace) break;

            charged += limit * 1000L;
            start = deadline;
            index++;
        }

        return new Position(index, start, index >= questions.Count ? start : null, charged);
    }

    /// <summary>Where a participant stands after finishing their current question at <paramref name="now"/>.</summary>
    public static Position Advance(Position from, int questionCount, DateTime now, long spentMs)
    {
        var next = from.QuestionIndex + 1;
        return new Position(next, now, next >= questionCount ? now : null, from.ChargedMs + spentMs);
    }

    /// <summary>
    /// A participant who never joined is counted from the start of the session,
    /// so skipping the join cannot buy a later clock.
    /// </summary>
    public static Task<ParticipantProgress> RowAsync(
        OpenQuizDbContext db, Guid pollId, string voterKey, string userName, CancellationToken ct) =>
        EnrollAsync(db, pollId, voterKey, userName, startedAt: null, ct);

    /// <summary>
    /// Records a participant on their first question. Joining again from a
    /// reloaded page keeps the place they already had.
    /// </summary>
    /// <param name="startedAt">Null while the room is still waiting: the clock then starts with the session.</param>
    public static async Task<ParticipantProgress> EnrollAsync(
        OpenQuizDbContext db, Guid pollId, string voterKey, string userName, DateTime? startedAt, CancellationToken ct)
    {
        var existing = await db.ParticipantProgress.AsNoTracking()
            .FirstOrDefaultAsync(p => p.PollId == pollId && p.VoterKey == voterKey, ct);
        if (existing is not null) return existing;

        var row = new ParticipantProgress
        {
            PollId = pollId,
            VoterKey = voterKey,
            UserName = userName.Trim(),
            QuestionStartedAt = startedAt,
        };
        db.ParticipantProgress.Add(row);
        try
        {
            await db.SaveChangesAsync(ct);
            return row;
        }
        catch (DbUpdateException ex) when (ConcurrentCounters.IsUniqueViolation(ex))
        {
            return await db.ParticipantProgress.AsNoTracking()
                .FirstAsync(p => p.PollId == pollId && p.VoterKey == voterKey, ct);
        }
        finally
        {
            db.Entry(row).State = EntityState.Detached;
        }
    }

    /// <summary>
    /// Saves a move unless another request for the same participant got there
    /// first, so a question's time is never charged twice.
    /// </summary>
    public static async Task<bool> MoveAsync(
        OpenQuizDbContext db, ParticipantProgress row, Position to, CancellationToken ct)
    {
        if (row.FinishedAt is not null || to.QuestionIndex == row.QuestionIndex) return false;

        var moved = await db.ParticipantProgress
            .Where(p => p.Id == row.Id && p.QuestionIndex == row.QuestionIndex && p.FinishedAt == null)
            .ExecuteUpdateAsync(set => set
                .SetProperty(p => p.QuestionIndex, to.QuestionIndex)
                .SetProperty(p => p.QuestionStartedAt, (DateTime?)to.StartedAt)
                .SetProperty(p => p.FinishedAt, to.FinishedAt), ct);
        return moved == 1;
    }

    /// <summary>
    /// Settles everyone still playing when the presenter ends the contest. They
    /// are charged what the rest of the clock would have cost, so an unfinished
    /// run never wins a tie against a finished one.
    /// </summary>
    public static async Task FinishEveryoneAsync(OpenQuizDbContext db, Poll poll, DateTime now, CancellationToken ct)
    {
        var questions = Ordered(poll);
        var open = await db.ParticipantProgress.AsNoTracking()
            .Where(p => p.PollId == poll.Id && p.FinishedAt == null)
            .ToListAsync(ct);

        foreach (var row in open)
        {
            var at = CatchUp(row, poll, questions, now, TimeSpan.Zero);
            if (!at.Finished)
            {
                var rest = questions.Skip(at.QuestionIndex).Sum(q => q.TimeLimit * 1000L);
                at = new Position(questions.Count, now, now, at.ChargedMs + rest);
            }

            if (await MoveAsync(db, row, at, ct))
                await ScoreLedger.AccumulateAsync(db, poll.Id, row.UserName, 0, at.ChargedMs, ct);
        }
    }
}
