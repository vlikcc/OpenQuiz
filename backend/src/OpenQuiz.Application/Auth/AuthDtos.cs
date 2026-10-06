namespace OpenQuiz.Application.Auth;

public record GoogleLoginRequest(string IdToken);

public record RegisterRequest(string Email, string Password, string? DisplayName);

public record LoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record PasswordResetRequest(string Email);

public record PasswordResetConfirm(string Token, string NewPassword);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt,
    DateTime RefreshTokenExpiresAt,
    UserDto User);

public record UserDto(
    Guid Id,
    string Email,
    string? DisplayName,
    bool IsAdmin,
    bool CanCreate);
