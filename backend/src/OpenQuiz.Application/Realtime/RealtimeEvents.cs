using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Scores;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Application.Realtime;

public record ReactionEvent(string Emoji, string? Sender, DateTime At);

public record ReactionTally(string Emoji, int Count);

/// <summary>
/// The standings as they stand, sent to a room after points change. Only the
/// visible top is carried; the full table is still a request away.
/// </summary>
public record LeaderboardUpdate(List<ScoreEntry> Entries);
