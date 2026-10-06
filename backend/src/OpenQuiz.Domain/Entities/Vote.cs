namespace OpenQuiz.Domain.Entities;

public class Vote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = string.Empty;

    /// <summary>
    /// Identity a vote is deduplicated on: the account id when the voter is
    /// signed in, otherwise the name they joined under. Anonymous voters can
    /// still come back under a different name — that needs participant tokens,
    /// not a database constraint.
    /// </summary>
    public string VoterKey { get; set; } = string.Empty;

    public string SelectedOptionIndices { get; set; } = "[]"; // JSON array
    public bool? IsCorrect { get; set; }
    public int? ResponseTimeMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
