using Microsoft.AspNetCore.SignalR;
using OpenQuiz.Api.Hubs;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Realtime;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Api.Realtime;

public class SignalRRealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<PollHub> _hub;
    private readonly RealtimeThrottle _throttle;

    public SignalRRealtimeNotifier(IHubContext<PollHub> hub, RealtimeThrottle throttle)
    {
        _hub = hub; _throttle = throttle;
    }

    public Task PollUpdatedAsync(Guid pollId, PollDto poll) =>
        _hub.Clients.Group(PollHub.GroupName(pollId)).SendAsync("PollUpdated", poll);

    public Task VoteCountsUpdatedAsync(Guid pollId, QuestionAggregate aggregate) =>
        _throttle.Coalesce($"vc:{pollId}:{aggregate.QuestionIndex}", aggregate,
            payload => _hub.Clients.Group(PollHub.GroupName(pollId))
                .SendAsync("VoteCountsUpdated", payload));

    public Task WordCloudUpdatedAsync(Guid pollId, WordCloudResponse payload) =>
        _throttle.Coalesce($"wc:{pollId}:{payload.QuestionIndex}", payload,
            p => _hub.Clients.Group(PollHub.GroupName(pollId))
                .SendAsync("WordCloudUpdated", p));

    public Task ReactionAsync(Guid pollId, ReactionEvent reaction) =>
        _hub.Clients.Group(PollHub.GroupName(pollId)).SendAsync("ReactionBurst", reaction);

    public Task OpenAnswerSubmittedAsync(Guid pollId, int questionIndex, string userName) =>
        _hub.Clients.Group(PollHub.GroupName(pollId))
            .SendAsync("OpenAnswerSubmitted", new { questionIndex, userName });

    // A room answering together moves the standings once per answer, and only
    // the last of those is worth drawing.
    public Task LeaderboardUpdatedAsync(Guid pollId, LeaderboardUpdate payload) =>
        _throttle.Coalesce($"lb:{pollId}", payload,
            p => _hub.Clients.Group(PollHub.GroupName(pollId))
                .SendAsync("LeaderboardUpdated", p));
}
