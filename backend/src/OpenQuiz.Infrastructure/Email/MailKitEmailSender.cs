using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Infrastructure.Options;

namespace OpenQuiz.Infrastructure.Email;

public class MailKitEmailSender : IEmailSender
{
    private readonly SmtpOptions _opts;
    private readonly ILogger<MailKitEmailSender> _logger;

    public MailKitEmailSender(IOptions<SmtpOptions> opts, ILogger<MailKitEmailSender> logger)
    {
        _opts = opts.Value;
        _logger = logger;
    }

    public bool IsConfigured => _opts.IsConfigured;

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            _logger.LogWarning("SMTP not configured; e-mail to {To} ({Subject}) dropped.", to, subject);
            return;
        }

        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(_opts.FromName, _opts.FromAddress));
        msg.To.Add(MailboxAddress.Parse(to));
        msg.Subject = subject;
        msg.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        using var client = new SmtpClient();
        var security = _opts.UseStartTls
            ? SecureSocketOptions.StartTlsWhenAvailable
            : SecureSocketOptions.Auto;

        await client.ConnectAsync(_opts.Host, _opts.Port, security, ct);

        if (!string.IsNullOrWhiteSpace(_opts.User))
            await client.AuthenticateAsync(_opts.User, _opts.Password ?? string.Empty, ct);

        await client.SendAsync(msg, ct);
        await client.DisconnectAsync(true, ct);
    }
}
