using OpenQuiz.Application.Reports;

namespace OpenQuiz.Application.Abstractions;

public interface IReportService
{
    /// <summary>
    /// Owner (or admin) only, and gated on <c>reports.export</c>. Ownership is
    /// checked first so a stranger probing someone else's poll gets 403, not
    /// a 402 that would leak the owner's plan tier.
    /// </summary>
    Task<PollReportDto> GetAsync(Guid pollId, CancellationToken ct);
}
