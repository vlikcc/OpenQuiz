using OpenQuiz.Application.Users;

namespace OpenQuiz.Application.Abstractions;

public interface IUserService
{
    Task<List<AuthorizedUserDto>> ListAuthorizedAsync(CancellationToken ct);
    Task AddAuthorizedAsync(AddAuthorizedUserRequest req, CancellationToken ct);
    Task RemoveAuthorizedAsync(string email, CancellationToken ct);
    Task<List<RegisteredUserDto>> ListRegisteredAsync(CancellationToken ct);
}
