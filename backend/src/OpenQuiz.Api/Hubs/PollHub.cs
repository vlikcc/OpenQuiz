using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Api.Hubs;

public class PollHub(OpenQuizDbContext db, ICurrentUser user) : Hub
{
    /// <summary>Every phone in the room: question changes, status and head count.</summary>
    public Task JoinPoll(string pollId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupName(pollId));

    public Task LeavePoll(string pollId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(pollId));

    /// <summary>
    /// The presenter's screen: standings, vote tallies, reactions and word
    /// clouds. Kept off the participant group so a thousand phones do not each
    /// receive a copy of every scoreboard redraw.
    /// </summary>
    public async Task JoinHost(string pollId)
    {
        await EnsureCanHostAsync(pollId);
        await Groups.AddToGroupAsync(Context.ConnectionId, HostGroupName(pollId));
    }

    public async Task LeaveHost(string pollId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, HostGroupName(pollId));
    }

    public static string GroupName(string pollId) => $"poll:{pollId}";
    public static string GroupName(Guid pollId) => GroupName(pollId.ToString());
    public static string HostGroupName(string pollId) => $"poll-host:{pollId}";
    public static string HostGroupName(Guid pollId) => HostGroupName(pollId.ToString());

    private async Task EnsureCanHostAsync(string pollId)
    {
        if (!Guid.TryParse(pollId, out var id))
            throw new HubException("Invalid poll.");
        if (!user.IsAuthenticated || user.UserId is not Guid uid)
            throw new HubException("Sign in to host this poll.");

        if (user.IsAdmin) return;

        var allowed = await db.Polls.AsNoTracking()
            .Where(p => p.Id == id)
            .AnyAsync(p => p.CreatorId == uid
                || p.Collaborators.Any(c => c.UserId == uid));
        if (!allowed) throw new HubException("Not a presenter on this poll.");
    }
}
