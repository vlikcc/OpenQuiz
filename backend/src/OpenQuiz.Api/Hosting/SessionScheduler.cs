using OpenQuiz.Application.Abstractions;

namespace OpenQuiz.Api.Hosting;

/// <summary>
/// The first hosted service in this repo. It only drives scheduled sessions
/// (reminder mail + auto-activate). Webhook receipt mail stays out of band
/// on purpose — a blocking SMTP handshake must not sit on a provider retry.
/// </summary>
public class SessionScheduler : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(15);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<SessionScheduler> _logger;
    private readonly IHostEnvironment _env;

    public SessionScheduler(IServiceScopeFactory scopes, ILogger<SessionScheduler> logger, IHostEnvironment env)
    {
        _scopes = scopes;
        _logger = logger;
        _env = env;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // The test host shares the database; a tick mid-suite would auto-start
        // polls the tests are still arranging.
        if (_env.IsEnvironment("Testing")) return;
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopes.CreateAsyncScope();
                var polls = scope.ServiceProvider.GetRequiredService<IPollService>();
                await polls.ProcessScheduledAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled-session tick failed.");
            }
        }
    }
}
