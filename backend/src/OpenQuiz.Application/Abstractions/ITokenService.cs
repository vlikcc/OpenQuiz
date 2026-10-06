using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Application.Abstractions;

public record TokenPair(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, DateTime RefreshTokenExpiresAt);

public interface ITokenService
{
    TokenPair IssueTokenPair(User user);
    string HashRefreshToken(string refreshToken);
}
