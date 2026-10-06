using System.Text.RegularExpressions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.WordCloud;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public partial class WordCloudService : IWordCloudService
{
    private readonly OpenQuizDbContext _db;
    private readonly IValidator<WordCloudSubmitRequest> _validator;
    private readonly IRealtimeNotifier _realtime;

    public WordCloudService(
        OpenQuizDbContext db,
        IValidator<WordCloudSubmitRequest> validator,
        IRealtimeNotifier realtime)
    {
        _db = db; _validator = validator; _realtime = realtime;
    }

    public async Task<WordCloudResponse> SubmitAsync(Guid pollId, WordCloudSubmitRequest req, CancellationToken ct)
    {
        await _validator.ValidateAndThrowAsync(req, ct);

        var poll = await _db.Polls.Include(p => p.Questions).FirstOrDefaultAsync(p => p.Id == pollId, ct)
                   ?? throw Errors.NotFound("Poll");

        var now = DateTime.UtcNow;
        var question = PollParticipation.EnsureVotable(poll, req.QuestionIndex, now);
        var settings = WordCloudSettings.Parse(question.WordCloudConfig);
        var userName = req.UserName.Trim();

        var accepted = await ModerateAsync(req.Terms, question, settings, userName, ct);

        foreach (var (original, term) in accepted)
        {
            _db.WordCloudSubmissions.Add(new WordCloudSubmission
            {
                PollId = poll.Id,
                QuestionId = question.Id,
                UserName = userName,
                Term = term,
                OriginalTerm = original,
                CreatedAt = now
            });
        }
        await _db.SaveChangesAsync(ct);

        // Tallies are kept separately from the raw submissions because a whole
        // room tends to send the same handful of words at once, and an
        // in-memory read-modify-write would drop most of those hits.
        foreach (var group in accepted.GroupBy(t => t.Normalized))
            await IncrementTermAsync(question.Id, group.Key, group.Count(), ct);

        var response = await ReadAsync(question, req.QuestionIndex, settings, settings.TopN, ct);
        await _realtime.WordCloudUpdatedAsync(pollId, response);
        return response;
    }

    public async Task<WordCloudResponse> GetAsync(Guid pollId, int questionIndex, int? topN, CancellationToken ct)
    {
        var poll = await _db.Polls.Include(p => p.Questions).AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pollId, ct)
            ?? throw Errors.NotFound("Poll");

        var question = poll.Questions.OrderBy(q => q.OrderIndex)
            .ElementAtOrDefault(questionIndex)
            ?? throw Errors.Validation("Question index out of range.");

        var settings = WordCloudSettings.Parse(question.WordCloudConfig);
        return await ReadAsync(question, questionIndex, settings, topN ?? settings.TopN, ct);
    }

    /// <summary>
    /// Decides what actually reaches the wall: the shape rules, then the
    /// organiser's blacklist and the profanity list, then the repeat policy.
    /// </summary>
    private async Task<List<(string Original, string Normalized)>> ModerateAsync(
        List<string> submitted,
        Question question,
        WordCloudSettings settings,
        string userName,
        CancellationToken ct)
    {
        var maxWords = question.MaxWords ?? settings.MaxWordsPerUser ?? 5;

        var wellFormed = submitted
            .Select(t => (Original: t.Trim(), Normalized: Normalize(t, settings.MaxTermLength)))
            .Where(t => !string.IsNullOrEmpty(t.Normalized) && TermRegex().IsMatch(t.Normalized))
            .Where(t => t.Normalized.Length >= settings.MinTermLength)
            .ToList();

        if (wellFormed.Count == 0)
            throw Errors.Validation("No valid terms after normalization.");

        var allowed = wellFormed.Where(t => !settings.IsBlocked(t.Normalized)).ToList();
        if (allowed.Count == 0)
            throw Errors.Validation("Those words are not allowed on this question.");

        if (!settings.AllowDuplicatesFromSameUser)
        {
            allowed = [.. allowed.DistinctBy(t => t.Normalized)];

            var candidates = allowed.Select(t => t.Normalized).ToList();
            var alreadySent = await _db.WordCloudSubmissions.AsNoTracking()
                .Where(s => s.QuestionId == question.Id
                            && s.UserName == userName
                            && candidates.Contains(s.Term))
                .Select(s => s.Term)
                .ToListAsync(ct);

            if (alreadySent.Count > 0)
            {
                var seen = alreadySent.ToHashSet();
                allowed = [.. allowed.Where(t => !seen.Contains(t.Normalized))];
            }

            if (allowed.Count == 0)
                throw Errors.Conflict("You have already sent those words.");
        }

        return [.. allowed.Take(maxWords)];
    }

    /// <summary>
    /// Blocked terms are filtered on the way out as well as on the way in, so
    /// adding a word to the blacklist mid-session clears what is already on the
    /// wall instead of only stopping the next sender.
    /// </summary>
    private async Task<WordCloudResponse> ReadAsync(
        Question question, int questionIndex, WordCloudSettings settings, int topN, CancellationToken ct)
    {
        var top = Math.Clamp(topN, 1, 500);
        var terms = await _db.WordCloudAggregates.AsNoTracking()
            .Where(a => a.QuestionId == question.Id)
            .OrderByDescending(a => a.Count)
            .Take(top + settings.Blacklist.Count)
            .Select(a => new WordCloudTerm(a.Term, a.Count))
            .ToListAsync(ct);

        return new WordCloudResponse(
            questionIndex,
            [.. terms.Where(t => !settings.IsBlocked(t.Term)).Take(top)]);
    }

    private Task IncrementTermAsync(Guid questionId, string term, int by, CancellationToken ct) =>
        ConcurrentCounters.IncrementOrCreateAsync(
            token => _db.WordCloudAggregates
                .Where(a => a.QuestionId == questionId && a.Term == term)
                .ExecuteUpdateAsync(set => set.SetProperty(a => a.Count, a => a.Count + by), token),
            async token =>
            {
                _db.WordCloudAggregates.Add(new WordCloudAggregate
                {
                    QuestionId = questionId,
                    Term = term,
                    Count = by
                });
                await _db.SaveChangesAsync(token);
            },
            ct);

    private static string Normalize(string raw, int maxLength)
    {
        var trimmed = raw.Trim().ToLowerInvariant();
        return trimmed.Length > maxLength ? trimmed[..maxLength] : trimmed;
    }

    [GeneratedRegex(@"^[\p{L}\p{N}][\p{L}\p{N}\-' ]{0,62}[\p{L}\p{N}]$|^[\p{L}\p{N}]$")]
    private static partial Regex TermRegex();
}
