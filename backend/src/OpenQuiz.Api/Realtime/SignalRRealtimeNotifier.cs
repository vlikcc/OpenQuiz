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

    // Joins rewrite the same snapshot hundreds of times a second; only the
    // latest head count is worth drawing, and every phone has to hear it.
    public Task PollUpdatedAsync(Guid pollId, PollDto poll) =>
        _throttle.Coalesce($"poll:{pollId}", poll,
            p => _hub.Clients.Group(PollHub.GroupName(pollId)).SendAsync("PollUpdated", p));

    // Charts, standings and reactions are projector-only. Sending them to the
    // participant group multiplies bandwidth by the size of the room.
    public Task VoteCountsUpdatedAsync(Guid pollId, QuestionAggregate aggregate) =>
        _throttle.Coalesce($"vc:{pollId}:{aggregate.QuestionIndex}", aggregate,
            payload => _hub.Clients.Group(PollHub.HostGroupName(pollId))
                .SendAsync("VoteCountsUpdated", payload));

    public Task WordCloudUpdatedAsync(Guid pollId, WordCloudResponse payload) =>
        _throttle.Coalesce($"wc:{pollId}:{payload.QuestionIndex}", payload,
            p => _hub.Clients.Group(PollHub.HostGroupName(pollId))
                .SendAsync("WordCloudUpdated", p));

    public Task ReactionAsync(Guid pollId, ReactionEvent reaction) =>
        _hub.Clients.Group(PollHub.HostGroupName(pollId)).SendAsync("ReactionBurst", reaction);

    public Task OpenAnswerSubmittedAsync(Guid pollId, int questionIndex, string userName) =>
        _hub.Clients.Group(PollHub.HostGroupName(pollId))
            .SendAsync("OpenAnswerSubmitted", new { questionIndex, userName });

    public Task LeaderboardUpdatedAsync(Guid pollId, LeaderboardUpdate payload) =>
        _throttle.Coalesce($"lb:{pollId}", payload,
            p => _hub.Clients.Group(PollHub.HostGroupName(pollId))
                .SendAsync("LeaderboardUpdated", p));
}
