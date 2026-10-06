using OpenQuiz.Application.Realtime;

namespace OpenQuiz.Application.Abstractions;

public record ReactionRequest(string Emoji, string? Sender);

public interface IReactionService
{
    Task<ReactionEvent> BroadcastAsync(Guid pollId, ReactionRequest req, CancellationToken ct);

    /// <summary>How often each reaction was sent over the whole session.</summary>
    Task<List<ReactionTally>> TallyAsync(Guid pollId, CancellationToken ct);
}
