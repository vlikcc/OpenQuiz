namespace OpenQuiz.Domain.Entities;

public class OpenAnswer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string AnswerText { get; set; } = string.Empty;
    public int? Score { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
