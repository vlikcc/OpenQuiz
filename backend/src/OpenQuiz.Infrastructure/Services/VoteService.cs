using System.Text.Json;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Realtime;
using OpenQuiz.Application.Votes;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class VoteService : IVoteService
{
    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;
    private readonly IRealtimeNotifier _realtime;
    private readonly IScoreService _scores;
    private readonly IValidator<SubmitVoteRequest> _vv;
    private readonly IValidator<SubmitOpenAnswerRequest> _ov;

    public VoteService(
        OpenQuizDbContext db,
        ICurrentUser user,
        IRealtimeNotifier realtime,
        IScoreService scores,
        IValidator<SubmitVoteRequest> vv,
        IValidator<SubmitOpenAnswerRequest> ov)
    {
        _db = db; _user = user; _realtime = realtime; _scores = scores; _vv = vv; _ov = ov;
    }

    public async Task<VoteDto> SubmitAsync(Guid pollId, SubmitVoteRequest req, CancellationToken ct)
    {
        await _vv.ValidateAndThrowAsync(req, ct);

        var now = DateTime.UtcNow;

        var poll = await _db.Polls.Include(p => p.Questions)
            .FirstOrDefaultAsync(p => p.Id == pollId, ct)
            ?? throw Errors.NotFound("Poll");

        var question = PollParticipation.EnsureVotable(poll, req.QuestionIndex, now);
        var elapsedMs = PollParticipation.ElapsedMs(poll, now, req.ResponseTimeMs);

        var voterKey = VoterKeyFor(req.UserName);
        var alreadyVoted = await _db.Votes
            .AnyAsync(v => v.QuestionId == question.Id && v.VoterKey == voterKey, ct);
        if (alreadyVoted) throw Errors.Conflict("You have already voted on this question.");

        bool? isCorrect = null;
        if ((poll.Type is PollType.Contest or PollType.Quiz or PollType.Exam) && question.CorrectOptionIndex.HasValue)
        {
            isCorrect = req.SelectedIndices.Count == 1 && req.SelectedIndices[0] == question.CorrectOptionIndex.Value;
        }

        var vote = new Vote
        {
            PollId = poll.Id,
            QuestionId = question.Id,
            UserId = _user.UserId,
            UserName = req.UserName.Trim(),
            VoterKey = voterKey,
            SelectedOptionIndices = JsonSerializer.Serialize(req.SelectedIndices),
            IsCorrect = isCorrect,
            ResponseTimeMs = elapsedMs,
            CreatedAt = now
        };
        _db.Votes.Add(vote);

        // The vote lands first so the unique index is what settles duplicates.
        // Awarding points before that would credit a replay that then gets
        // rejected.
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ConcurrentCounters.IsUniqueViolation(ex))
        {
            throw Errors.Conflict("You have already voted on this question.");
        }

        if (isCorrect == true)
            await AwardPointsAsync(poll.Id, vote.UserName, question.Points, elapsedMs, ct);

        // Recompute aggregate for this question and notify.
        var thisQ = await SingleQuestionAggregateAsync(poll.Id, question.Id, req.QuestionIndex, ct);
        await _realtime.VoteCountsUpdatedAsync(pollId, thisQ);

        return new VoteDto(vote.Id, vote.QuestionId, vote.UserName, req.SelectedIndices,
            vote.IsCorrect, vote.ResponseTimeMs, vote.CreatedAt);
    }

    public async Task<OpenAnswerDto> SubmitOpenAsync(Guid pollId, SubmitOpenAnswerRequest req, CancellationToken ct)
    {
        await _ov.ValidateAndThrowAsync(req, ct);

        var now = DateTime.UtcNow;

        var poll = await _db.Polls.Include(p => p.Questions)
            .FirstOrDefaultAsync(p => p.Id == pollId, ct)
            ?? throw Errors.NotFound("Poll");

        var question = PollParticipation.EnsureVotable(poll, req.QuestionIndex, now);

        var entity = new OpenAnswer
        {
            PollId = poll.Id,
            QuestionId = question.Id,
            UserId = _user.UserId,
            UserName = req.UserName.Trim(),
            AnswerText = req.AnswerText,
            CreatedAt = now
        };
        _db.OpenAnswers.Add(entity);
        await _db.SaveChangesAsync(ct);
        await _realtime.OpenAnswerSubmittedAsync(pollId, req.QuestionIndex, entity.UserName);

        return new OpenAnswerDto(entity.Id, entity.QuestionId, entity.UserName, entity.AnswerText, entity.Score, entity.CreatedAt);
    }

    public async Task<PagedResult<VoteDto>> ListAsync(Guid pollId, PageRequest page, CancellationToken ct)
    {
        EnsureOwnerAccess(pollId);

        var q = _db.Votes.AsNoTracking().Where(v => v.PollId == pollId);
        var total = await q.CountAsync(ct);

        var votes = await q
            .OrderBy(v => v.CreatedAt).ThenBy(v => v.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync(ct);

        var items = votes.Select(v => new VoteDto(
            v.Id, v.QuestionId, v.UserName,
            ParseIndices(v.SelectedOptionIndices),
            v.IsCorrect, v.ResponseTimeMs, v.CreatedAt)).ToList();

        return new PagedResult<VoteDto>(items, page.Page, page.PageSize, total);
    }

    public async Task<PagedResult<OpenAnswerDto>> ListOpenAsync(Guid pollId, PageRequest page, CancellationToken ct)
    {
        EnsureOwnerAccess(pollId);

        var q = _db.OpenAnswers.AsNoTracking().Where(a => a.PollId == pollId);
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderBy(a => a.CreatedAt).ThenBy(a => a.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(a => new OpenAnswerDto(a.Id, a.QuestionId, a.UserName, a.AnswerText, a.Score, a.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<OpenAnswerDto>(items, page.Page, page.PageSize, total);
    }

    /// <summary>
    /// Open-ended answers carry no points until somebody reads them, so an exam
    /// used to end with the written half missing from the leaderboard. Grading
    /// moves the difference, which makes correcting a grade safe.
    /// </summary>
    public async Task<OpenAnswerDto> ScoreOpenAsync(
        Guid pollId, Guid answerId, ScoreOpenAnswerRequest req, CancellationToken ct)
    {
        EnsureOwnerAccess(pollId);

        var answer = await _db.OpenAnswers.FirstOrDefaultAsync(a => a.Id == answerId && a.PollId == pollId, ct)
                     ?? throw Errors.NotFound("Answer");

        var maxPoints = await _db.Questions.AsNoTracking()
            .Where(q => q.Id == answer.QuestionId)
            .Select(q => (int?)q.Points)
            .FirstOrDefaultAsync(ct)
            ?? throw Errors.NotFound("Question");

        if (req.Score is int score && (score < 0 || score > maxPoints))
            throw Errors.Validation($"Score must be between 0 and {maxPoints}.");

        var delta = (req.Score ?? 0) - (answer.Score ?? 0);
        answer.Score = req.Score;
        await _db.SaveChangesAsync(ct);

        if (delta != 0)
            await AwardPointsAsync(pollId, answer.UserName, delta, elapsedMs: 0, ct);

        return new OpenAnswerDto(
            answer.Id, answer.QuestionId, answer.UserName, answer.AnswerText, answer.Score, answer.CreatedAt);
    }

    public async Task<List<QuestionAggregate>> AggregatesAsync(Guid pollId, CancellationToken ct)
    {
        var poll = await _db.Polls.Include(p => p.Questions).AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pollId, ct)
            ?? throw Errors.NotFound("Poll");

        // Selections are stored as a JSON array, so the counting has to happen
        // here rather than in a GROUP BY. Only the three columns it needs are
        // fetched, which keeps a busy poll from dragging every vote row across.
        var votes = await _db.Votes.AsNoTracking()
            .Where(v => v.PollId == pollId)
            .Select(v => new { v.QuestionId, v.UserName, v.SelectedOptionIndices })
            .ToListAsync(ct);

        var orderedQuestions = poll.Questions.OrderBy(q => q.OrderIndex).ToList();
        var result = new List<QuestionAggregate>(orderedQuestions.Count);
        for (var i = 0; i < orderedQuestions.Count; i++)
        {
            var q = orderedQuestions[i];
            var qVotes = votes.Where(v => v.QuestionId == q.Id).ToList();
            var counts = new Dictionary<int, int>();
            foreach (var v in qVotes)
            {
                foreach (var idx in ParseIndices(v.SelectedOptionIndices))
                    counts[idx] = counts.GetValueOrDefault(idx) + 1;
            }
            result.Add(new QuestionAggregate(i, q.Id, qVotes.Select(v => v.UserName).Distinct().Count(), counts));
        }
        return result;
    }

    /// <summary>
    /// Adds to a running total, so two answers scored at the same moment do not
    /// overwrite each other, and tells the room where it now stands.
    /// </summary>
    private async Task AwardPointsAsync(Guid pollId, string userName, int points, int elapsedMs, CancellationToken ct)
    {
        await AccumulateAsync(pollId, userName, points, elapsedMs, ct);

        var standings = await _scores.LeaderboardAsync(pollId, LeaderboardSize, ct);
        await _realtime.LeaderboardUpdatedAsync(pollId, new LeaderboardUpdate(standings));
    }

    /// <summary>How much of the table a live screen shows.</summary>
    private const int LeaderboardSize = 10;

    private Task AccumulateAsync(Guid pollId, string userName, int points, int elapsedMs, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        return ConcurrentCounters.IncrementOrCreateAsync(
            token => _db.Scores
                .Where(s => s.PollId == pollId && s.UserName == userName)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(s => s.Points, s => s.Points + points)
                    .SetProperty(s => s.TotalTimeMs, s => s.TotalTimeMs + elapsedMs)
                    .SetProperty(s => s.UpdatedAt, now), token),
            async token =>
            {
                _db.Scores.Add(new Score
                {
                    PollId = pollId,
                    UserName = userName,
                    Points = points,
                    TotalTimeMs = elapsedMs,
                    UpdatedAt = now
                });
                await _db.SaveChangesAsync(token);
            },
            ct);
    }

    // Signed-in voters are deduplicated on their account, anonymous ones on the
    // name they joined under, which is the only identity they have.
    private string VoterKeyFor(string userName) =>
        _user.UserId is Guid uid
            ? $"user:{uid}"
            : $"anon:{userName.Trim().ToLowerInvariant()}";

    private void EnsureOwnerAccess(Guid pollId)
    {
        if (!_user.IsAuthenticated) throw Errors.Unauthorized();
        if (_user.IsAdmin) return;

        var creatorId = _db.Polls.Where(p => p.Id == pollId).Select(p => (Guid?)p.CreatorId).FirstOrDefault();
        if (creatorId is null) throw Errors.NotFound("Poll");
        if (_user.UserId != creatorId) throw Errors.Forbidden();
    }

    private async Task<QuestionAggregate> SingleQuestionAggregateAsync(Guid pollId, Guid questionId, int questionIndex, CancellationToken ct)
    {
        var votes = await _db.Votes.AsNoTracking()
            .Where(v => v.QuestionId == questionId)
            .Select(v => new { v.UserName, v.SelectedOptionIndices })
            .ToListAsync(ct);

        var counts = new Dictionary<int, int>();
        foreach (var v in votes)
        {
            foreach (var idx in ParseIndices(v.SelectedOptionIndices))
                counts[idx] = counts.GetValueOrDefault(idx) + 1;
        }

        var distinctUserCount = votes.Select(v => v.UserName).Distinct().Count();
        return new QuestionAggregate(questionIndex, questionId, distinctUserCount, counts);
    }

    private static List<int> ParseIndices(string json)
    {
        try { return JsonSerializer.Deserialize<List<int>>(json) ?? []; }
        catch { return []; }
    }
}
