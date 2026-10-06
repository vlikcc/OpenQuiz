using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Application.Polls;

public record CreatePollRequest(
    string Title,
    PollType Type,
    List<QuestionInput> Questions,
    DateTime? ScheduledStartAt = null);

public record UpdatePollRequest(
    string Title,
    PollType Type,
    List<QuestionInput> Questions,
    DateTime? ScheduledStartAt = null);

/// <summary>
/// Copies a poll's questions into a fresh, unstarted one. The title is optional
/// so a client can localise it; the server names the copy when it is omitted.
/// </summary>
public record DuplicatePollRequest(string? Title = null);

public record QuestionInput(
    int OrderIndex,
    string Text,
    string? ImageUrl,
    int TimeLimit,
    QuestionType QuestionType,
    bool AllowMultiple,
    int? CorrectOptionIndex,
    string? CorrectAnswer,
    int Points,
    int? MaxWords,
    string? WordCloudConfig,
    List<OptionInput> Options);

public record OptionInput(int OrderIndex, string Text);

public record PollDto(
    Guid Id,
    string Title,
    PollType Type,
    PollStatus Status,
    int CurrentQuestionIndex,
    int ParticipantCount,
    bool IsActive,
    Guid CreatorId,
    string CreatorEmail,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    /// <summary>
    /// UTC instant the current question went on screen, or null when no question
    /// is running. Clients count down from this rather than from their own load
    /// time, so a late joiner sees the same remaining seconds as everyone else.
    /// </summary>
    DateTime? QuestionStartedAt,
    /// <summary>
    /// The server's clock at the moment this snapshot was produced. A client
    /// subtracts it from its own to find its offset, which is what lets a late
    /// joiner or a phone with a wrong clock draw the same countdown as the room.
    /// </summary>
    DateTime ServerTime,
    List<QuestionDto> Questions,
    string? JoinCode,
    DateTime? ScheduledStartAt,
    string? ResultsShareToken,
    bool IsCollaborator,
    IReadOnlyList<CollaboratorDto> Collaborators);

/// <summary>
/// What the poll list needs. The full <see cref="PollDto"/> carries every
/// question and option, which is a lot of payload for a screen that only prints
/// how many there are.
/// </summary>
public record PollSummaryDto(
    Guid Id,
    string Title,
    PollType Type,
    PollStatus Status,
    int CurrentQuestionIndex,
    int ParticipantCount,
    bool IsActive,
    Guid CreatorId,
    string CreatorEmail,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    int QuestionCount,
    string? JoinCode,
    DateTime? ScheduledStartAt,
    bool HasResultsShare,
    bool IsCollaborator);

public record QuestionDto(
    Guid Id,
    int OrderIndex,
    string Text,
    string? ImageUrl,
    int TimeLimit,
    QuestionType QuestionType,
    bool AllowMultiple,
    int? CorrectOptionIndex,
    string? CorrectAnswer,
    int Points,
    int? MaxWords,
    string? WordCloudConfig,
    List<OptionDto> Options);

public record OptionDto(Guid Id, int OrderIndex, string Text);

public record JoinPollRequest(string UserName);

public record CollaboratorDto(Guid UserId, string Email);

public record AddCollaboratorRequest(string Email);
