using System.Net.Http.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Votes;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The standings only existed as a request the presentation screen never made,
/// so a contest ran to the end with nobody in the room knowing who was winning.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class LiveLeaderboardTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task A_correct_answer_pushes_the_standings_to_the_room()
    {
        var (_, poll) = await LiveContestAsync();

        await VoteAsync(poll.Id, 0, correct: true, "Ada");

        var standings = Assert.Single(Api.Realtime.Leaderboards);
        var leader = Assert.Single(standings.Entries);
        Assert.Equal("Ada", leader.UserName);
        Assert.Equal(10, leader.Points);
    }

    [Fact]
    public async Task A_wrong_answer_leaves_the_standings_alone()
    {
        var (_, poll) = await LiveContestAsync();

        await VoteAsync(poll.Id, 0, correct: false, "Ada");

        Assert.Empty(Api.Realtime.Leaderboards);
    }

    [Fact]
    public async Task The_standings_arrive_in_order_with_the_leader_first()
    {
        var (owner, poll) = await LiveContestAsync();

        await VoteAsync(poll.Id, 0, correct: true, "Ada");
        await VoteAsync(poll.Id, 0, correct: true, "Grace");

        (await owner.PostAsync($"/api/polls/{poll.Id}/next-question", null)).EnsureSuccessStatusCode();
        await VoteAsync(poll.Id, 1, correct: true, "Grace");

        var latest = Api.Realtime.Leaderboards.Last();
        Assert.Equal(["Grace", "Ada"], latest.Entries.Select(e => e.UserName).ToArray());
        Assert.Equal([20, 10], latest.Entries.Select(e => e.Points).ToArray());
    }

    /// <summary>
    /// Phones capitalise the first letter on one screen and not the next. The
    /// standings are keyed on a case-insensitive collation so that is still
    /// one person with one total, not two half-scores.
    /// </summary>
    [Fact]
    public async Task A_name_typed_in_a_different_case_keeps_one_total()
    {
        var (owner, poll) = await LiveContestAsync();

        await VoteAsync(poll.Id, 0, correct: true, "Ayşe");
        (await owner.PostAsync($"/api/polls/{poll.Id}/next-question", null)).EnsureSuccessStatusCode();
        await VoteAsync(poll.Id, 1, correct: true, "ayşe");

        var leader = Assert.Single(Api.Realtime.Leaderboards.Last().Entries);
        Assert.Equal("Ayşe", leader.UserName);
        Assert.Equal(20, leader.Points);
    }

    /// <summary>
    /// Grading the written half of an exam moves the table too, otherwise the
    /// screen would disagree with the scores until somebody reloaded it.
    /// </summary>
    [Fact]
    public async Task Grading_a_written_answer_pushes_the_standings_too()
    {
        using var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, ExamPoll());
        await ActivateAsync(owner, poll.Id);

        var answer = await ReadAsync<OpenAnswerDto>(
            await PostAsync(Anonymous, $"/api/polls/{poll.Id}/open-answers",
                new SubmitOpenAnswerRequest(0, "A written answer", "Ada")));

        var response = await owner.PutAsJsonAsync(
            $"/api/polls/{poll.Id}/open-answers/{answer.Id}/score", new ScoreOpenAnswerRequest(12));
        response.EnsureSuccessStatusCode();

        var standings = Assert.Single(Api.Realtime.Leaderboards);
        Assert.Equal(12, Assert.Single(standings.Entries).Points);
    }

    private async Task VoteAsync(Guid pollId, int questionIndex, bool correct, string voter)
    {
        var response = await PostAsync(Anonymous, $"/api/polls/{pollId}/votes",
            new SubmitVoteRequest(questionIndex, [correct ? 1 : 0], 500, voter));
        response.EnsureSuccessStatusCode();
    }

    private async Task<(HttpClient Owner, PollDto Poll)> LiveContestAsync()
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, ContestPoll());
        await ActivateAsync(owner, poll.Id);
        return (owner, poll);
    }

    private static CreatePollRequest ContestPoll() => new(
        "Two round contest",
        PollType.Contest,
        [ContestQuestion(0), ContestQuestion(1)]);

    private static QuestionInput ContestQuestion(int order) => new(
        OrderIndex: order,
        Text: $"Question {order + 1}",
        ImageUrl: null,
        TimeLimit: 600,
        QuestionType: QuestionType.MultipleChoice,
        AllowMultiple: false,
        CorrectOptionIndex: 1,
        CorrectAnswer: null,
        Points: 10,
        MaxWords: null,
        WordCloudConfig: null,
        Options: [new OptionInput(0, "No"), new OptionInput(1, "Yes")]);

    private static CreatePollRequest ExamPoll() => new(
        "Written exam",
        PollType.Exam,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "Explain",
                ImageUrl: null,
                TimeLimit: 600,
                QuestionType: QuestionType.Open,
                AllowMultiple: false,
                CorrectOptionIndex: null,
                CorrectAnswer: null,
                Points: 20,
                MaxWords: null,
                WordCloudConfig: null,
                Options: []),
        ]);
}
