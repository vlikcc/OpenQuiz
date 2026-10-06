namespace OpenQuiz.Domain.Entities;

public class Reaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public string? Sender { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
