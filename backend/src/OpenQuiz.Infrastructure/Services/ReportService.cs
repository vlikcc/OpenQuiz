using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Reports;
using OpenQuiz.Application.Scores;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class ReportService : IReportService
{
    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;
    private readonly IEntitlementService _entitlements;
    private readonly IVoteService _votes;

    public ReportService(
        OpenQuizDbContext db,
        ICurrentUser user,
        IEntitlementService entitlements,
        IVoteService votes)
    {
        _db = db; _user = user; _entitlements = entitlements; _votes = votes;
    }

    public async Task<PollReportDto> GetAsync(Guid pollId, CancellationToken ct)
    {
        var poll = await _db.Polls
            .Include(p => p.Questions)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pollId, ct)
            ?? throw Errors.NotFound("Poll");

        // Ownership before the feature gate, otherwise a stranger's 402 would
        // tell them which plan the owner is on.
        if (!_user.IsAuthenticated) throw Errors.Unauthorized();
        if (!_user.IsAdmin && _user.UserId != poll.CreatorId)
            throw Errors.Forbidden();

        await _entitlements.EnsureFeatureAsync(EntitlementKeys.ReportsExport, ct);

        var aggregates = await _votes.AggregatesAsync(pollId, ct);

        var scores = await _db.Scores.AsNoTracking()
            .Where(s => s.PollId == pollId)
            .OrderByDescending(s => s.Points).ThenBy(s => s.TotalTimeMs)
            .Select(s => new ScoreEntry(s.UserName, s.Points, s.TotalTimeMs))
            .ToListAsync(ct);

        var voteRows = await _db.Votes.AsNoTracking()
            .Where(v => v.PollId == pollId)
            .OrderBy(v => v.CreatedAt).ThenBy(v => v.Id)
            .ToListAsync(ct);

        var votes = voteRows.Select(v => new VoteDto(
            v.Id, v.QuestionId, v.UserName,
            ParseIndices(v.SelectedOptionIndices),
            v.IsCorrect, v.ResponseTimeMs, v.CreatedAt)).ToList();

        var openAnswers = await _db.OpenAnswers.AsNoTracking()
            .Where(a => a.PollId == pollId)
            .OrderBy(a => a.CreatedAt).ThenBy(a => a.Id)
            .Select(a => new OpenAnswerDto(a.Id, a.QuestionId, a.UserName, a.AnswerText, a.Score, a.CreatedAt))
            .ToListAsync(ct);

        var clouds = new List<WordCloudReportItem>();
        foreach (var q in poll.Questions.OrderBy(q => q.OrderIndex))
        {
            if (q.QuestionType != QuestionType.WordCloud) continue;

            var terms = await _db.WordCloudAggregates.AsNoTracking()
                .Where(a => a.QuestionId == q.Id)
                .OrderByDescending(a => a.Count)
                .Select(a => new WordCloudTerm(a.Term, a.Count))
                .ToListAsync(ct);

            clouds.Add(new WordCloudReportItem(q.OrderIndex, q.Id, q.Text, terms));
        }

        return new PollReportDto(
            poll.Id, poll.Title, poll.ParticipantCount,
            scores, aggregates, votes, openAnswers, clouds);
    }

    private static List<int> ParseIndices(string json)
    {
        try { return JsonSerializer.Deserialize<List<int>>(json) ?? []; }
        catch { return []; }
    }
}
