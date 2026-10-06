namespace OpenQuiz.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? PasswordHash { get; set; }
    public string? GoogleSub { get; set; }
    public bool IsAdmin { get; set; }
    public bool CanCreate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<Poll> CreatedPolls { get; set; } = new List<Poll>();
}
