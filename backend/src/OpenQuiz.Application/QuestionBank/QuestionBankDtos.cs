using OpenQuiz.Application.Polls;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Application.QuestionBank;

public record QuestionBankItemDto(
    Guid Id,
    string Text,
    string? ImageUrl,
    int TimeLimit,
    QuestionType QuestionType,
    bool AllowMultiple,
    int? CorrectOptionIndex,
    string? CorrectAnswer,
    int Points,
    int? MaxWords,
    string? WordCloudConfig,
    DateTime CreatedAt,
    List<OptionDto> Options);

public record SaveQuestionBankItemRequest(
    string Text,
    string? ImageUrl,
    int TimeLimit,
    QuestionType QuestionType,
    bool AllowMultiple,
    int? CorrectOptionIndex,
    string? CorrectAnswer,
    int Points,
    int? MaxWords,
    string? WordCloudConfig,
    List<OptionInput> Options);
