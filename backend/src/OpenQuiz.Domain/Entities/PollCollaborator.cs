namespace OpenQuiz.Domain.Entities;

/// <summary>
/// A second presenter on a poll. v1 has no roles: the row itself is the
/// grant to activate / step / end. Editing questions, deleting, and managing
/// collaborators stay with the owner.
/// </summary>
public class PollCollaborator
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }
    public Poll Poll { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
