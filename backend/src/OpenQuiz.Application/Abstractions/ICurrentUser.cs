namespace OpenQuiz.Application.Abstractions;

public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Email { get; }
    bool IsAdmin { get; }
    bool CanCreate { get; }
    bool IsAuthenticated { get; }
}
