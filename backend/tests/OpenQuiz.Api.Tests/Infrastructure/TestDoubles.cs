using System.Collections.Concurrent;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Realtime;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Api.Tests.Infrastructure;

public sealed record SentEmail(string To, string Subject, string HtmlBody);

/// <summary>Keeps the reset mails in memory so tests can follow the link.</summary>
public sealed class CapturingEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<SentEmail> _sent = new();

    public bool IsConfigured => true;

    public IReadOnlyCollection<SentEmail> Sent => _sent;

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        _sent.Enqueue(new SentEmail(to, subject, htmlBody));
        return Task.CompletedTask;
    }
}

/// <summary>
/// Records what the hub would have broadcast. The real notifier fans out to
/// connected clients, which a test host has none of, and the payload itself is
/// what the redaction rules have to get right.
/// </summary>
public sealed class RecordingRealtimeNotifier : IRealtimeNotifier
{
    private readonly ConcurrentQueue<PollDto> _pollUpdates = new();
    private readonly ConcurrentQueue<LeaderboardUpdate> _leaderboards = new();

    public IReadOnlyCollection<PollDto> PollUpdates => _pollUpdates;

    public IReadOnlyCollection<LeaderboardUpdate> Leaderboards => _leaderboards;

    public Task PollUpdatedAsync(Guid pollId, PollDto poll)
    {
        _pollUpdates.Enqueue(poll);
        return Task.CompletedTask;
    }

    public Task VoteCountsUpdatedAsync(Guid pollId, QuestionAggregate aggregate) => Task.CompletedTask;

    public Task WordCloudUpdatedAsync(Guid pollId, WordCloudResponse payload) => Task.CompletedTask;

    public Task ReactionAsync(Guid pollId, ReactionEvent reaction) => Task.CompletedTask;

    public Task OpenAnswerSubmittedAsync(Guid pollId, int questionIndex, string userName) => Task.CompletedTask;

    public Task LeaderboardUpdatedAsync(Guid pollId, LeaderboardUpdate payload)
    {
        _leaderboards.Enqueue(payload);
        return Task.CompletedTask;
    }
}
