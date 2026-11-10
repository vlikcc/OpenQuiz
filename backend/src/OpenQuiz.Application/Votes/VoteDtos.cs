namespace OpenQuiz.Application.Votes;

public record SubmitVoteRequest(
    int QuestionIndex,
    List<int> SelectedIndices,
    int? ResponseTimeMs,
    string UserName);

public record SubmitOpenAnswerRequest(
    int QuestionIndex,
    string AnswerText,
    string UserName);

/// <summary>
/// A participant in a self-paced contest asking where they are. Naming the
/// question they ran out of time on moves them past it.
/// </summary>
public record ProgressRequest(string UserName, int? SkipQuestionIndex = null);

/// <summary>
/// One participant's place in a self-paced contest. <see cref="ServerTime"/>
/// plays the same part as on the poll snapshot: it lets the phone draw a
/// countdown that agrees with the deadline the server enforces.
/// </summary>
public record ParticipantProgressDto(
    int QuestionIndex,
    DateTime? QuestionStartedAt,
    bool Finished,
    int Points,
    DateTime ServerTime);

public record VoteDto(
    Guid Id,
    Guid QuestionId,
    string UserName,
    List<int> SelectedIndices,
    bool? IsCorrect,
    int? ResponseTimeMs,
    DateTime CreatedAt);

/// <summary>
/// A grade for one open-ended answer. Null clears a grade that was awarded by
/// mistake, which also takes the points back off the leaderboard.
/// </summary>
public record ScoreOpenAnswerRequest(int? Score);

public record OpenAnswerDto(
    Guid Id,
    Guid QuestionId,
    string UserName,
    string AnswerText,
    int? Score,
    DateTime CreatedAt);

public record QuestionAggregate(
    int QuestionIndex,
    Guid QuestionId,
    int TotalRespondents,
    Dictionary<int, int> OptionCounts);
