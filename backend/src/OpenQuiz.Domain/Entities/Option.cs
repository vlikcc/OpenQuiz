namespace OpenQuiz.Domain.Entities;

public class Option
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public int OrderIndex { get; set; }
    public string Text { get; set; } = string.Empty;
}
