using System.Security.Cryptography;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Auth;
using OpenQuiz.Application.Common;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly OpenQuizDbContext _db;
    private readonly ITokenService _tokens;
    private readonly IGoogleTokenVerifier _google;
    private readonly IPasswordHasher _hasher;
    private readonly IEmailSender _email;
    private readonly AppOptions _app;
    private readonly ILogger<AuthService> _logger;
    private readonly IValidator<RegisterRequest> _registerValidator;
    private readonly IValidator<LoginRequest> _loginValidator;
    private readonly IValidator<GoogleLoginRequest> _googleValidator;
    private readonly IValidator<RefreshRequest> _refreshValidator;
    private readonly IValidator<PasswordResetRequest> _resetReqValidator;
    private readonly IValidator<PasswordResetConfirm> _resetConfirmValidator;

    public AuthService(
        OpenQuizDbContext db,
        ITokenService tokens,
        IGoogleTokenVerifier google,
        IPasswordHasher hasher,
        IEmailSender email,
        IOptions<AppOptions> app,
        ILogger<AuthService> logger,
        IValidator<RegisterRequest> rv,
        IValidator<LoginRequest> lv,
        IValidator<GoogleLoginRequest> gv,
        IValidator<RefreshRequest> rfv,
        IValidator<PasswordResetRequest> rrv,
        IValidator<PasswordResetConfirm> rcv)
    {
        _db = db; _tokens = tokens; _google = google; _hasher = hasher; _email = email;
        _app = app.Value; _logger = logger;
        _registerValidator = rv; _loginValidator = lv; _googleValidator = gv;
        _refreshValidator = rfv; _resetReqValidator = rrv; _resetConfirmValidator = rcv;
    }

    public async Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest req, CancellationToken ct)
    {
        await _googleValidator.ValidateAndThrowAsync(req, ct);

        var identity = await _google.VerifyAsync(req.IdToken, ct);
        if (string.IsNullOrWhiteSpace(identity.Email) || !identity.EmailVerified)
            throw Errors.Unauthorized("Google account e-mail is not verified.");

        var normalizedEmail = identity.Email.ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.GoogleSub == identity.Sub, ct)
                ?? await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);

        if (user is null)
        {
            user = new User
            {
                Email = normalizedEmail,
                DisplayName = identity.Name,
                GoogleSub = identity.Sub,
                IsAdmin = string.Equals(_app.AdminEmail, normalizedEmail, StringComparison.OrdinalIgnoreCase),
                CanCreate = false,
                CreatedAt = DateTime.UtcNow,
                LastLoginAt = DateTime.UtcNow
            };
            if (user.IsAdmin) user.CanCreate = true;
            _db.Users.Add(user);
        }
        else
        {
            user.GoogleSub ??= identity.Sub;
            user.DisplayName ??= identity.Name;
            user.LastLoginAt = DateTime.UtcNow;
            if (string.Equals(_app.AdminEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                user.IsAdmin = true;
                user.CanCreate = true;
            }
        }

        await _db.SaveChangesAsync(ct);
        return await IssueAsync(user, ct);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest req, CancellationToken ct)
    {
        await _registerValidator.ValidateAndThrowAsync(req, ct);
        var email = req.Email.ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            throw Errors.Conflict("E-mail already registered.");

        var user = new User
        {
            Email = email,
            DisplayName = req.DisplayName ?? email,
            PasswordHash = _hasher.Hash(req.Password),
            IsAdmin = string.Equals(_app.AdminEmail, email, StringComparison.OrdinalIgnoreCase),
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow
        };
        if (user.IsAdmin) user.CanCreate = true;

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return await IssueAsync(user, ct);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        await _loginValidator.ValidateAndThrowAsync(req, ct);
        var email = req.Email.ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || string.IsNullOrEmpty(user.PasswordHash) || !_hasher.Verify(req.Password, user.PasswordHash))
            throw Errors.Unauthorized("Invalid credentials.");

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await IssueAsync(user, ct);
    }

    public async Task<AuthResponse> RefreshAsync(RefreshRequest req, CancellationToken ct)
    {
        await _refreshValidator.ValidateAndThrowAsync(req, ct);
        var hash = _tokens.HashRefreshToken(req.RefreshToken);

        var token = await _db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct)
            ?? throw Errors.Unauthorized("Refresh token invalid.");

        if (!token.IsActive)
            throw Errors.Unauthorized("Refresh token expired or revoked.");

        token.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await IssueAsync(token.User, ct);
    }

    public async Task LogoutAsync(LogoutRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.RefreshToken)) return;
        var hash = _tokens.HashRefreshToken(req.RefreshToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is { RevokedAt: null }) { token.RevokedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); }
    }

    public async Task<UserDto?> GetMeAsync(Guid userId, CancellationToken ct)
    {
        var u = await _db.Users.FindAsync([userId], ct);
        return u is null ? null : new UserDto(u.Id, u.Email, u.DisplayName, u.IsAdmin, u.CanCreate);
    }

    public async Task PasswordResetRequestAsync(PasswordResetRequest req, CancellationToken ct)
    {
        await _resetReqValidator.ValidateAndThrowAsync(req, ct);

        if (!_email.IsConfigured)
            throw Errors.ServiceUnavailable("SMTP is not configured on this server.");

        var email = req.Email.ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        // Always return success — do not leak existence. But only send if user exists.
        if (user is null) return;

        var rawToken = GenerateOpaqueToken();
        var entity = new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = _tokens.HashRefreshToken(rawToken),
            ExpiresAt = DateTime.UtcNow.AddHours(_app.PasswordResetTokenHours),
            CreatedAt = DateTime.UtcNow
        };
        _db.PasswordResetTokens.Add(entity);
        await _db.SaveChangesAsync(ct);

        var resetUrl = $"{_app.PublicUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(rawToken)}";
        var html = $"""
            <p>Merhaba {System.Net.WebUtility.HtmlEncode(user.DisplayName ?? user.Email)},</p>
            <p>Şifre sıfırlama talebiniz alındı. Aşağıdaki bağlantıyı {_app.PasswordResetTokenHours} saat içinde kullanabilirsiniz:</p>
            <p><a href="{resetUrl}">{resetUrl}</a></p>
            <p>Bu talebi siz yapmadıysanız mesajı yok sayabilirsiniz.</p>
            """;
        try
        {
            await _email.SendAsync(user.Email, "OpenQuiz şifre sıfırlama", html, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset e-mail to {Email}", user.Email);
            throw Errors.ServiceUnavailable("Could not send the reset e-mail.");
        }
    }

    public async Task PasswordResetConfirmAsync(PasswordResetConfirm req, CancellationToken ct)
    {
        await _resetConfirmValidator.ValidateAndThrowAsync(req, ct);

        var hash = _tokens.HashRefreshToken(req.Token);
        var token = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct)
            ?? throw Errors.Unauthorized("Invalid or expired reset token.");

        if (!token.IsActive)
            throw Errors.Unauthorized("Invalid or expired reset token.");

        var now = DateTime.UtcNow;
        token.User.PasswordHash = _hasher.Hash(req.NewPassword);
        token.UsedAt = now;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        await _db.SaveChangesAsync(ct);

        // A reset is the recovery path for a stolen account, so every existing
        // session and any other pending reset link dies with it. Access tokens
        // already handed out cannot be recalled; they expire on their own within
        // Jwt:AccessTokenMinutes.
        await _db.RefreshTokens
            .Where(t => t.UserId == token.UserId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);

        await _db.PasswordResetTokens
            .Where(t => t.UserId == token.UserId && t.Id != token.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);

        await tx.CommitAsync(ct);

        _logger.LogInformation("Password reset completed for {UserId}; all sessions revoked.", token.UserId);
    }

    private async Task<AuthResponse> IssueAsync(User user, CancellationToken ct)
    {
        var pair = _tokens.IssueTokenPair(user);
        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = _tokens.HashRefreshToken(pair.RefreshToken),
            ExpiresAt = pair.RefreshTokenExpiresAt,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return new AuthResponse(
            pair.AccessToken,
            pair.RefreshToken,
            pair.AccessTokenExpiresAt,
            pair.RefreshTokenExpiresAt,
            new UserDto(user.Id, user.Email, user.DisplayName, user.IsAdmin, user.CanCreate));
    }

    private static string GenerateOpaqueToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(48);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
