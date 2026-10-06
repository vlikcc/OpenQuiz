using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Users;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _current;

    public UserService(OpenQuizDbContext db, ICurrentUser current)
    {
        _db = db; _current = current;
    }

    public async Task<List<AuthorizedUserDto>> ListAuthorizedAsync(CancellationToken ct)
    {
        EnsureAdmin();
        return await _db.Users.AsNoTracking()
            .Where(u => u.CanCreate)
            .OrderBy(u => u.Email)
            .Select(u => new AuthorizedUserDto(u.Email, u.CreatedAt, null))
            .ToListAsync(ct);
    }

    public async Task AddAuthorizedAsync(AddAuthorizedUserRequest req, CancellationToken ct)
    {
        EnsureAdmin();
        if (string.IsNullOrWhiteSpace(req.Email) || !req.Email.Contains('@'))
            throw Errors.Validation("Invalid e-mail.");

        var email = req.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null)
        {
            user = new User { Email = email, CanCreate = true, CreatedAt = DateTime.UtcNow };
            _db.Users.Add(user);
        }
        else
        {
            user.CanCreate = true;
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveAuthorizedAsync(string email, CancellationToken ct)
    {
        EnsureAdmin();
        var normalized = email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalized, ct);
        if (user is null) return;

        // If user has no real account (no password, no Google sub), remove the row.
        if (string.IsNullOrEmpty(user.PasswordHash) && string.IsNullOrEmpty(user.GoogleSub))
            _db.Users.Remove(user);
        else
            user.CanCreate = false;

        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<RegisteredUserDto>> ListRegisteredAsync(CancellationToken ct)
    {
        EnsureAdmin();
        return await _db.Users.AsNoTracking()
            .Where(u => u.PasswordHash != null || u.GoogleSub != null)
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new RegisteredUserDto(u.Id, u.Email, u.DisplayName, u.CreatedAt, u.CanCreate))
            .ToListAsync(ct);
    }

    private void EnsureAdmin()
    {
        if (!_current.IsAuthenticated) throw Errors.Unauthorized();
        if (!_current.IsAdmin) throw Errors.Forbidden();
    }
}
