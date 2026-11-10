using System.Net;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Scores;
using OpenQuiz.Application.Votes;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// In a self-paced contest nobody waits for the presenter: answering a question
/// opens the next one for that participant alone, and equal scores are settled
/// by who got through fastest.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class SelfPacedContestTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Answering_moves_only_that_participant_to_the_next_question()
    {
        var (_, poll) = await LiveContestAsync();
        await JoinAsync(poll.Id, "Ada");
        await JoinAsync(poll.Id, "Grace");

        (await VoteAsync(poll.Id, 0, correct: true, "Ada")).EnsureSuccessStatusCode();

        Assert.Equal(1, (await ProgressAsync(poll.Id, "Ada")).QuestionIndex);
        Assert.Equal(0, (await ProgressAsync(poll.Id, "Grace")).QuestionIndex);
        Assert.Equal(HttpStatusCode.Conflict, (await VoteAsync(poll.Id, 1, correct: true, "Grace")).StatusCode);
        (await VoteAsync(poll.Id, 1, correct: true, "Ada")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Answering_the_last_question_finishes_the_run()
    {
        var (_, poll) = await LiveContestAsync();

        await VoteAsync(poll.Id, 0, correct: true, "Ada");
        await VoteAsync(poll.Id, 1, correct: false, "Ada");

        var progress = await ProgressAsync(poll.Id, "Ada");
        Assert.True(progress.Finished);
        Assert.Equal(10, progress.Points);
        Assert.Equal(HttpStatusCode.Conflict, (await VoteAsync(poll.Id, 1, correct: true, "Ada")).StatusCode);
    }

    [Fact]
    public async Task Equal_scores_are_ranked_by_who_finished_fastest()
    {
        var (_, poll) = await LiveContestAsync();
        await JoinAsync(poll.Id, "Ada");
        await JoinAsync(poll.Id, "Grace");

        await StartedAgoAsync(poll.Id, "Ada", TimeSpan.FromSeconds(40));
        await VoteAsync(poll.Id, 0, correct: true, "Ada");
        await VoteAsync(poll.Id, 1, correct: true, "Ada");

        await StartedAgoAsync(poll.Id, "Grace", TimeSpan.FromSeconds(10));
        await VoteAsync(poll.Id, 0, correct: true, "Grace");
        await VoteAsync(poll.Id, 1, correct: true, "Grace");

        var standings = await LeaderboardAsync(poll.Id);
        Assert.Equal(["Grace", "Ada"], standings.Select(s => s.UserName).ToArray());
        Assert.All(standings, s => Assert.Equal(20, s.Points));
    }

    /// <summary>
    /// A wrong answer moves the participant on too, and its time counts: the
    /// clock measures getting through the contest, not only the right answers.
    /// </summary>
    [Fact]
    public async Task Wrong_answers_still_count_towards_the_finishing_time()
    {
        var (_, poll) = await LiveContestAsync();

        await StartedAgoAsync(poll.Id, "Ada", TimeSpan.FromSeconds(30));
        await VoteAsync(poll.Id, 0, correct: false, "Ada");

        var ada = Assert.Single(await LeaderboardAsync(poll.Id));
        Assert.Equal(0, ada.Points);
        Assert.True(ada.TotalTimeMs >= 30_000, $"recorded {ada.TotalTimeMs} ms");
    }

    [Fact]
    public async Task Running_out_of_time_moves_the_participant_on()
    {
        var (_, poll) = await LiveContestAsync(seconds: 20);

        await StartedAgoAsync(poll.Id, "Ada", TimeSpan.FromSeconds(25));

        Assert.Equal(HttpStatusCode.Conflict, (await VoteAsync(poll.Id, 0, correct: true, "Ada")).StatusCode);
        var progress = await ProgressAsync(poll.Id, "Ada");
        Assert.Equal(1, progress.QuestionIndex);
        (await VoteAsync(poll.Id, 1, correct: true, "Ada")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task A_phone_whose_countdown_ran_out_can_move_itself_on()
    {
        var (_, poll) = await LiveContestAsync();

        var progress = await ProgressAsync(poll.Id, "Ada", skip: 0);

        Assert.Equal(1, progress.QuestionIndex);
        Assert.NotNull(progress.QuestionStartedAt);
    }

    /// <summary>
    /// Ending the contest while someone is still playing charges them the rest
    /// of the clock, so stopping halfway cannot beat finishing on equal points.
    /// </summary>
    [Fact]
    public async Task Ending_the_contest_ranks_an_unfinished_run_behind_a_finished_one()
    {
        var (owner, poll) = await LiveContestAsync();
        await JoinAsync(poll.Id, "Ada");
        await JoinAsync(poll.Id, "Grace");

        await StartedAgoAsync(poll.Id, "Ada", TimeSpan.FromSeconds(30));
        await VoteAsync(poll.Id, 0, correct: true, "Ada");
        await VoteAsync(poll.Id, 1, correct: false, "Ada");
        await VoteAsync(poll.Id, 0, correct: true, "Grace");

        Assert.Equal(new ContestProgress(2, 1), await ContestProgressAsync(poll.Id));

        (await owner.PostAsync($"/api/polls/{poll.Id}/end", null)).EnsureSuccessStatusCode();

        var standings = await LeaderboardAsync(poll.Id);
        Assert.Equal(["Ada", "Grace"], standings.Select(s => s.UserName).ToArray());
        Assert.Equal(new ContestProgress(2, 2), await ContestProgressAsync(poll.Id));
    }

    [Fact]
    public async Task Someone_who_joined_in_the_waiting_room_starts_with_the_session()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, Contest(seconds: 600));
        await JoinAsync(poll.Id, "Ada");

        var live = await ActivateAsync(owner, poll.Id);
        var progress = await ProgressAsync(poll.Id, "Ada");

        Assert.Equal(live.QuestionStartedAt, progress.QuestionStartedAt);
    }

    [Fact]
    public async Task The_presenter_cannot_move_a_self_paced_room()
    {
        var (owner, poll) = await LiveContestAsync();

        var next = await owner.PostAsync($"/api/polls/{poll.Id}/next-question", null);

        Assert.Equal(HttpStatusCode.Conflict, next.StatusCode);
    }

    [Fact]
    public async Task Only_multiple_choice_contests_can_run_self_paced()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());

        var survey = await PostAsync(owner, "/api/polls", Contest(seconds: 600) with { Type = PollType.Survey });

        Assert.Equal(HttpStatusCode.BadRequest, survey.StatusCode);
    }

    [Fact]
    public async Task The_poll_tells_participants_it_is_self_paced()
    {
        var (_, poll) = await LiveContestAsync();

        var seen = await ReadAsync<PollDto>(await Anonymous.GetAsync($"/api/polls/{poll.Id}"));

        Assert.True(seen.SelfPaced);
    }

    private async Task JoinAsync(Guid pollId, string name) =>
        (await PostAsync(Anonymous, $"/api/polls/{pollId}/join", new JoinPollRequest(name))).EnsureSuccessStatusCode();

    private Task<HttpResponseMessage> VoteAsync(Guid pollId, int questionIndex, bool correct, string voter) =>
        PostAsync(Anonymous, $"/api/polls/{pollId}/votes",
            new SubmitVoteRequest(questionIndex, [correct ? 1 : 0], 500, voter));

    private async Task<ParticipantProgressDto> ProgressAsync(Guid pollId, string voter, int? skip = null) =>
        await ReadAsync<ParticipantProgressDto>(
            await PostAsync(Anonymous, $"/api/polls/{pollId}/progress", new ProgressRequest(voter, skip)));

    private async Task<List<ScoreEntry>> LeaderboardAsync(Guid pollId) =>
        await ReadAsync<List<ScoreEntry>>(await Anonymous.GetAsync($"/api/scores?pollId={pollId}&top=10"));

    private async Task<ContestProgress> ContestProgressAsync(Guid pollId) =>
        await ReadAsync<ContestProgress>(await Anonymous.GetAsync($"/api/scores/progress?pollId={pollId}"));

    /// <summary>
    /// Opens the participant's current question some time ago, which is how a
    /// test gets a slow answer or an expired timer without waiting for one.
    /// </summary>
    private async Task StartedAgoAsync(Guid pollId, string voter, TimeSpan ago)
    {
        await ProgressAsync(pollId, voter);
        await using var db = CreateDbContext();
        await db.ParticipantProgress
            .Where(p => p.PollId == pollId && p.UserName == voter)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.QuestionStartedAt, DateTime.UtcNow - ago));
    }

    private async Task<(HttpClient Owner, PollDto Poll)> LiveContestAsync(int seconds = 600)
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, Contest(seconds));
        await ActivateAsync(owner, poll.Id);
        return (owner, poll);
    }

    private static CreatePollRequest Contest(int seconds) => new(
        "Self-paced contest",
        PollType.Contest,
        [Question(0, seconds), Question(1, seconds)],
        SelfPaced: true);

    private static QuestionInput Question(int order, int seconds) => new(
        OrderIndex: order,
        Text: $"Question {order + 1}",
        ImageUrl: null,
        TimeLimit: seconds,
        QuestionType: QuestionType.MultipleChoice,
        AllowMultiple: false,
        CorrectOptionIndex: 1,
        CorrectAnswer: null,
        Points: 10,
        MaxWords: null,
        WordCloudConfig: null,
        Options: [new OptionInput(0, "No"), new OptionInput(1, "Yes")]);
}
