namespace OpenQuiz.Application.Abstractions;

public record GoogleIdentity(string Sub, string Email, string? Name, string? Picture, bool EmailVerified);

public interface IGoogleTokenVerifier
{
    Task<GoogleIdentity> VerifyAsync(string idToken, CancellationToken ct = default);
}
