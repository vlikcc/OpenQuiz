using FluentValidation;

namespace OpenQuiz.Application.Votes;

public class SubmitVoteValidator : AbstractValidator<SubmitVoteRequest>
{
    public SubmitVoteValidator()
    {
        RuleFor(x => x.QuestionIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SelectedIndices).NotNull().Must(s => s.Count > 0).WithMessage("At least one option must be selected.");
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(128);
    }
}

public class SubmitOpenAnswerValidator : AbstractValidator<SubmitOpenAnswerRequest>
{
    public SubmitOpenAnswerValidator()
    {
        RuleFor(x => x.QuestionIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AnswerText).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(128);
    }
}
