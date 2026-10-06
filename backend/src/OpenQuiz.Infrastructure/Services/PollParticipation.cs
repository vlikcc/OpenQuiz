using OpenQuiz.Application.Common;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Infrastructure.Services;

internal static class PollParticipation
{
    /// <summary>
    /// A phone on a conference Wi-Fi can easily be a second behind the server, and
    /// the request itself takes time to arrive. Answers sent right on the buzzer
    /// are accepted rather than punished for the network.
    /// </summary>
    public static readonly TimeSpan Grace = TimeSpan.FromSeconds(2);

    /// <summary>
    /// Answers are only accepted for the question the presenter is currently on,
    /// in a poll that is actually running, and only while its timer is running.
    /// Without this a participant could replay the whole quiz before it starts or
    /// after it ends, or take as long as they liked on a timed question by
    /// ignoring the countdown their own browser was drawing.
    /// </summary>
    public static Question EnsureVotable(Poll poll, int questionIndex, DateTime now)
    {
        if (poll.Status != PollStatus.Live)
            throw Errors.Conflict("This poll is not accepting answers right now.");

        if (questionIndex != poll.CurrentQuestionIndex)
            throw Errors.Conflict("This question is no longer open.");

        var question = poll.Questions.OrderBy(q => q.OrderIndex).ElementAtOrDefault(questionIndex)
                       ?? throw Errors.Validation("Question index out of range.");

        if (HasExpired(poll, question, now))
            throw Errors.Conflict("Time is up for this question.");

        return question;
    }

    /// <summary>
    /// Milliseconds since the presenter opened the question. Preferred over the
    /// figure the client reports, which decides tie-breaks and is therefore worth
    /// forging. Falls back to the client's number for polls started before the
    /// server began recording the question's start.
    /// </summary>
    public static int ElapsedMs(Poll poll, DateTime now, int? reportedMs)
    {
        if (poll.QuestionStartedAt is not DateTime started)
            return Math.Max(0, reportedMs ?? 0);

        var elapsed = (now - started).TotalMilliseconds;
        return (int)Math.Clamp(elapsed, 0, int.MaxValue);
    }

    private static bool HasExpired(Poll poll, Question question, DateTime now)
    {
        // A poll that was already running when this column was added has no start
        // to measure from, and refusing every answer would be worse than not
        // enforcing the limit for the rest of that session.
        if (poll.QuestionStartedAt is not DateTime started) return false;
        if (question.TimeLimit <= 0) return false;

        return now > started.AddSeconds(question.TimeLimit).Add(Grace);
    }
}
