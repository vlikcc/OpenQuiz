using FluentValidation;

namespace OpenQuiz.Application.WordCloud;

public class WordCloudSubmitValidator : AbstractValidator<WordCloudSubmitRequest>
{
    public WordCloudSubmitValidator()
    {
        RuleFor(x => x.QuestionIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Terms).NotNull().Must(t => t.Count > 0).WithMessage("At least one term required.");
    }
}
