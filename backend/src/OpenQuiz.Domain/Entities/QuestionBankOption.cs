namespace OpenQuiz.Domain.Entities;

public class QuestionBankOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ItemId { get; set; }
    public QuestionBankItem Item { get; set; } = null!;
    public int OrderIndex { get; set; }
    public string Text { get; set; } = string.Empty;
}
