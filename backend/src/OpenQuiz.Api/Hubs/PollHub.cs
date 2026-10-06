using Microsoft.AspNetCore.SignalR;

namespace OpenQuiz.Api.Hubs;

public class PollHub : Hub
{
    public Task JoinPoll(string pollId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupName(pollId));

    public Task LeavePoll(string pollId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(pollId));

    public static string GroupName(string pollId) => $"poll:{pollId}";
    public static string GroupName(Guid pollId) => GroupName(pollId.ToString());
}
