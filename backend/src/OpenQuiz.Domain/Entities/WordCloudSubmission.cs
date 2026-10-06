namespace OpenQuiz.Domain.Entities;

public class WordCloudSubmission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;          // normalized
    public string OriginalTerm { get; set; } = string.Empty;  // as-typed
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
