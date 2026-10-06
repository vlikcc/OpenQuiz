using OpenQuiz.Application.Common;
using OpenQuiz.Application.Polls;

namespace OpenQuiz.Application.Abstractions;

public interface IPollService
{
    Task<PagedResult<PollSummaryDto>> ListAsync(PageRequest page, CancellationToken ct);
    Task<PollDto?> GetAsync(Guid id, CancellationToken ct);
    Task<PollDto> CreateAsync(CreatePollRequest req, CancellationToken ct);
    Task<PollDto> UpdateAsync(Guid id, UpdatePollRequest req, CancellationToken ct);
    Task<PollDto> DuplicateAsync(Guid id, DuplicatePollRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<PollDto> ActivateAsync(Guid id, CancellationToken ct);
    Task<PollDto> NextQuestionAsync(Guid id, CancellationToken ct);
    Task<PollDto> PrevQuestionAsync(Guid id, CancellationToken ct);
    Task<PollDto> EndAsync(Guid id, CancellationToken ct);
    /// <summary>Owner-only: drop every answer, score and reaction and put the poll back in the waiting room.</summary>
    Task<PollDto> ResetResultsAsync(Guid id, CancellationToken ct);
    Task<PollDto> JoinAsync(Guid id, JoinPollRequest req, CancellationToken ct);
    Task<PollDto?> GetByJoinCodeAsync(string code, CancellationToken ct);
    Task<IReadOnlyList<CollaboratorDto>> ListCollaboratorsAsync(Guid pollId, CancellationToken ct);
    Task<CollaboratorDto> AddCollaboratorAsync(Guid pollId, AddCollaboratorRequest req, CancellationToken ct);
    Task RemoveCollaboratorAsync(Guid pollId, Guid userId, CancellationToken ct);
    Task<PollDto> EnableResultsShareAsync(Guid id, CancellationToken ct);
    Task DisableResultsShareAsync(Guid id, CancellationToken ct);
    Task<PollDto?> GetByShareTokenAsync(string token, CancellationToken ct);
    /// <summary>Scheduler tick: reminder mails then auto-activate due waiting polls.</summary>
    Task ProcessScheduledAsync(CancellationToken ct);
}
