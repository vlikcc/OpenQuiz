using OpenQuiz.Application.Common;
using OpenQuiz.Application.QuestionBank;

namespace OpenQuiz.Application.Abstractions;

public interface IQuestionBankService
{
    Task<IReadOnlyList<QuestionBankItemDto>> ListMineAsync(CancellationToken ct);
    Task<QuestionBankItemDto> CreateAsync(SaveQuestionBankItemRequest req, CancellationToken ct);
    Task<QuestionBankItemDto> UpdateAsync(Guid id, SaveQuestionBankItemRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}
