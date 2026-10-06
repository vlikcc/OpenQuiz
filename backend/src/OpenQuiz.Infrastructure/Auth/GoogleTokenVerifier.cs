using Google.Apis.Auth;
using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Infrastructure.Options;

namespace OpenQuiz.Infrastructure.Auth;

public class GoogleTokenVerifier : IGoogleTokenVerifier
{
    private readonly GoogleAuthOptions _opts;

    public GoogleTokenVerifier(IOptions<GoogleAuthOptions> opts) => _opts = opts.Value;

    public async Task<GoogleIdentity> VerifyAsync(string idToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opts.ClientId))
            throw new InvalidOperationException("Google ClientId is not configured.");

        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { _opts.ClientId }
        };

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

        return new GoogleIdentity(
            Sub: payload.Subject,
            Email: payload.Email ?? string.Empty,
            Name: payload.Name,
            Picture: payload.Picture,
            EmailVerified: payload.EmailVerified);
    }
}
