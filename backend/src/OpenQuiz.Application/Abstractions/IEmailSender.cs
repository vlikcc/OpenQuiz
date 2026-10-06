namespace OpenQuiz.Application.Abstractions;

public interface IEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}
