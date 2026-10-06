using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Application.Abstractions;

public interface IWordCloudService
{
    Task<WordCloudResponse> SubmitAsync(Guid pollId, WordCloudSubmitRequest req, CancellationToken ct);
    /// <summary>Leave <paramref name="topN"/> null to use the question's own setting.</summary>
    Task<WordCloudResponse> GetAsync(Guid pollId, int questionIndex, int? topN, CancellationToken ct);
}
