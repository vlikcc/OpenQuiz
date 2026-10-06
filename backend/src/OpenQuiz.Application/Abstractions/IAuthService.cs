using OpenQuiz.Application.Auth;

namespace OpenQuiz.Application.Abstractions;

public interface IAuthService
{
    Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest req, CancellationToken ct);
    Task<AuthResponse> RegisterAsync(RegisterRequest req, CancellationToken ct);
    Task<AuthResponse> LoginAsync(LoginRequest req, CancellationToken ct);
    Task<AuthResponse> RefreshAsync(RefreshRequest req, CancellationToken ct);
    Task LogoutAsync(LogoutRequest req, CancellationToken ct);
    Task<UserDto?> GetMeAsync(Guid userId, CancellationToken ct);
    Task PasswordResetRequestAsync(PasswordResetRequest req, CancellationToken ct);
    Task PasswordResetConfirmAsync(PasswordResetConfirm req, CancellationToken ct);
}
