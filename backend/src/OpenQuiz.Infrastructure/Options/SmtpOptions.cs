namespace OpenQuiz.Infrastructure.Options;

public class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string? User { get; set; }
    public string? Password { get; set; }
    public string FromAddress { get; set; } = "no-reply@openquiz.local";
    public string FromName { get; set; } = "OpenQuiz";
    public bool UseStartTls { get; set; } = true;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host);
}
