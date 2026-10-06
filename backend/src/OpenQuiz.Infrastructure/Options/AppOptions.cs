namespace OpenQuiz.Infrastructure.Options;

public class AppOptions
{
    public const string SectionName = "App";

    public string PublicUrl { get; set; } = "http://localhost:5173";
    public string? AdminEmail { get; set; }
    public int PasswordResetTokenHours { get; set; } = 2;
}
