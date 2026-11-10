namespace OpenQuiz.Application.Scores;

public record ScoreEntry(string UserName, int Points, long TotalTimeMs);

/// <summary>How far a self-paced room has got: who is in it, and who has answered everything.</summary>
public record ContestProgress(int Participants, int Finished);
