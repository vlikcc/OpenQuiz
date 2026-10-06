namespace OpenQuiz.Domain.Entities;

public class Score
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? PollId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public int Points { get; set; }
    public long TotalTimeMs { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
