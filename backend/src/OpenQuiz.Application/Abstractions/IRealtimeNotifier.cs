using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Realtime;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Application.Abstractions;

public interface IRealtimeNotifier
{
    Task PollUpdatedAsync(Guid pollId, PollDto poll);
    Task VoteCountsUpdatedAsync(Guid pollId, QuestionAggregate aggregate);
    Task WordCloudUpdatedAsync(Guid pollId, WordCloudResponse payload);
    Task ReactionAsync(Guid pollId, ReactionEvent reaction);
    Task OpenAnswerSubmittedAsync(Guid pollId, int questionIndex, string userName);
    Task LeaderboardUpdatedAsync(Guid pollId, LeaderboardUpdate payload);
}
