using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Realtime;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class ReactionService : IReactionService
{
    private readonly OpenQuizDbContext _db;
    private readonly IRealtimeNotifier _realtime;

    public ReactionService(OpenQuizDbContext db, IRealtimeNotifier realtime)
    {
        _db = db; _realtime = realtime;
    }

    public async Task<ReactionEvent> BroadcastAsync(Guid pollId, ReactionRequest req, CancellationToken ct)
    {
        var emoji = Sanitize(req.Emoji);

        if (!await _db.Polls.AnyAsync(p => p.Id == pollId, ct))
            throw Errors.NotFound("Poll");

        var now = DateTime.UtcNow;
        var sender = string.IsNullOrWhiteSpace(req.Sender)
            ? null
            : req.Sender.Trim()[..Math.Min(req.Sender.Trim().Length, 128)];

        // Kept rather than only broadcast, so the room's reaction to a question
        // is still there when the session is reviewed afterwards.
        _db.Reactions.Add(new Reaction
        {
            PollId = pollId,
            Emoji = emoji,
            Sender = sender,
            CreatedAt = now
        });
        await _db.SaveChangesAsync(ct);

        var ev = new ReactionEvent(emoji, sender, now);
        await _realtime.ReactionAsync(pollId, ev);
        return ev;
    }

    public async Task<List<ReactionTally>> TallyAsync(Guid pollId, CancellationToken ct) =>
        await _db.Reactions.AsNoTracking()
            .Where(r => r.PollId == pollId)
            .GroupBy(r => r.Emoji)
            .OrderByDescending(g => g.Count())
            .Select(g => new ReactionTally(g.Key, g.Count()))
            .ToListAsync(ct);

    /// <summary>
    /// Reactions land on a screen in front of a room without anybody approving
    /// them, so only symbols are allowed through — letters and digits would let
    /// a participant put a sentence up there.
    /// </summary>
    private static string Sanitize(string? emoji)
    {
        if (string.IsNullOrWhiteSpace(emoji))
            throw Errors.Validation("Emoji required.");

        var trimmed = emoji.Trim();
        if (trimmed.Length > 16)
            throw Errors.Validation("Emoji is too long.");
        if (trimmed.Any(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c)))
            throw Errors.Validation("Only symbols are allowed as a reaction.");

        return trimmed;
    }
}
