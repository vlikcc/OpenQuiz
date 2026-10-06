namespace OpenQuiz.Domain.Entities;

public class WordCloudAggregate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuestionId { get; set; }
    public string Term { get; set; } = string.Empty;
    public int Count { get; set; }
}
