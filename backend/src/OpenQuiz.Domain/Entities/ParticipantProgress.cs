namespace OpenQuiz.Domain.Entities;

/// <summary>
/// Where one participant is in a self-paced contest. Everyone moves on as soon
/// as they answer, so the clock that bounds an answer — and the time that
/// breaks a tie — belongs to the participant rather than to the room.
/// </summary>
public class ParticipantProgress
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }

    /// <summary>Same identity votes are deduplicated on.</summary>
    public string VoterKey { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;
    public int QuestionIndex { get; set; }

    /// <summary>
    /// When the participant's current question opened. Null for someone who
    /// joined in the waiting room: their first question opens with the session.
    /// </summary>
    public DateTime? QuestionStartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
