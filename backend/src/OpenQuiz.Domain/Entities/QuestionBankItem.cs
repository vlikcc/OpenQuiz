using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Domain.Entities;

/// <summary>
/// A reusable question owned by one user. Copied into a poll as a new
/// <see cref="Question"/> — never referenced by FK — so editing a live poll
/// cannot mutate the bank.
/// </summary>
public class QuestionBankItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerUserId { get; set; }
    public User Owner { get; set; } = null!;

    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int TimeLimit { get; set; } = 30;
    public QuestionType QuestionType { get; set; } = QuestionType.MultipleChoice;
    public bool AllowMultiple { get; set; }
    public int? CorrectOptionIndex { get; set; }
    public string? CorrectAnswer { get; set; }
    public int Points { get; set; } = 10;
    public int? MaxWords { get; set; }
    public string? WordCloudConfig { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<QuestionBankOption> Options { get; set; } = new List<QuestionBankOption>();
}
