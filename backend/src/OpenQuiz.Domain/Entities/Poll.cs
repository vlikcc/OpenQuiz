using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Domain.Entities;

public class Poll
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public PollType Type { get; set; }
    public PollStatus Status { get; set; } = PollStatus.Waiting;
    public int CurrentQuestionIndex { get; set; }
    public int ParticipantCount { get; set; }
    public bool IsActive { get; set; }

    /// <summary>
    /// When the presenter put the current question on screen. The countdown every
    /// participant sees is derived from this, so a client that pauses its own
    /// timer cannot buy itself extra seconds.
    /// </summary>
    public DateTime? QuestionStartedAt { get; set; }

    public Guid CreatorId { get; set; }
    public User Creator { get; set; } = null!;

    /// <summary>Six-character room code. Null only on rows that predate the column until first read backfills it.</summary>
    public string? JoinCode { get; set; }

    public DateTime? ScheduledStartAt { get; set; }
    public DateTime? ReminderSentAt { get; set; }

    /// <summary>Unguessable token for the public ended-results page. Null until the owner turns sharing on.</summary>
    public string? ResultsShareToken { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Optimistic-concurrency token, mapped to PostgreSQL's <c>xmin</c> system column.</summary>
    public uint RowVersion { get; set; }

    public ICollection<Question> Questions { get; set; } = new List<Question>();
    public ICollection<PollCollaborator> Collaborators { get; set; } = new List<PollCollaborator>();
}
