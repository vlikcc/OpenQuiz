using FluentValidation;
using OpenQuiz.Application.Polls;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Application.QuestionBank;

public class SaveQuestionBankItemValidator : AbstractValidator<SaveQuestionBankItemRequest>
{
    public SaveQuestionBankItemValidator()
    {
        RuleFor(x => ToInput(x)).SetValidator(new QuestionInputValidator());
    }

    private static QuestionInput ToInput(SaveQuestionBankItemRequest x) => new(
        0, x.Text, x.ImageUrl, x.TimeLimit, x.QuestionType, x.AllowMultiple,
        x.CorrectOptionIndex, x.CorrectAnswer, x.Points, x.MaxWords, x.WordCloudConfig,
        x.Options);
}
