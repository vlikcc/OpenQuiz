using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Domain.Entities;

public class Question
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PollId { get; set; }
    public Poll Poll { get; set; } = null!;

    public int OrderIndex { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int TimeLimit { get; set; } = 30;
    public QuestionType QuestionType { get; set; } = QuestionType.MultipleChoice;
    public bool AllowMultiple { get; set; }
    public int? CorrectOptionIndex { get; set; }
    public string? CorrectAnswer { get; set; }
    public int Points { get; set; } = 10;

    // Word cloud–specific
    public int? MaxWords { get; set; }
    public string? WordCloudConfig { get; set; } // JSON

    public ICollection<Option> Options { get; set; } = new List<Option>();
}
