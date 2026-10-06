using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.Scores;
using OpenQuiz.Application.Votes;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Written answers carried no points at all, so an exam ended with half of it
/// missing from the leaderboard and no way to award the rest.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class OpenAnswerScoringTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Grading_an_answer_puts_the_points_on_the_leaderboard()
    {
        var (owner, poll, answer) = await AnsweredExamAsync();

        var graded = await ReadAsync<OpenAnswerDto>(await ScoreAsync(owner, poll.Id, answer.Id, 15));

        Assert.Equal(15, graded.Score);
        Assert.Equal(15, await PointsAsync(poll.Id, "Ada"));
    }

    /// <summary>
    /// A grader who mistypes has to be able to fix it, which means the second
    /// grade replaces the first instead of stacking on top of it.
    /// </summary>
    [Fact]
    public async Task Regrading_moves_the_difference_rather_than_adding_again()
    {
        var (owner, poll, answer) = await AnsweredExamAsync();

        (await ScoreAsync(owner, poll.Id, answer.Id, 20)).EnsureSuccessStatusCode();
        (await ScoreAsync(owner, poll.Id, answer.Id, 5)).EnsureSuccessStatusCode();

        Assert.Equal(5, await PointsAsync(poll.Id, "Ada"));
    }

    [Fact]
    public async Task Clearing_a_grade_takes_the_points_back()
    {
        var (owner, poll, answer) = await AnsweredExamAsync();

        (await ScoreAsync(owner, poll.Id, answer.Id, 20)).EnsureSuccessStatusCode();
        var cleared = await ReadAsync<OpenAnswerDto>(await ScoreAsync(owner, poll.Id, answer.Id, null));

        Assert.Null(cleared.Score);
        Assert.Equal(0, await PointsAsync(poll.Id, "Ada"));
    }

    [Fact]
    public async Task A_grade_above_what_the_question_is_worth_is_refused()
    {
        var (owner, poll, answer) = await AnsweredExamAsync();

        var tooMuch = await ScoreAsync(owner, poll.Id, answer.Id, 40);

        Assert.Equal(HttpStatusCode.BadRequest, tooMuch.StatusCode);
        Assert.Equal(0, await PointsAsync(poll.Id, "Ada"));
    }

    [Fact]
    public async Task A_negative_grade_is_refused()
    {
        var (owner, poll, answer) = await AnsweredExamAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await ScoreAsync(owner, poll.Id, answer.Id, -5)).StatusCode);
    }

    [Fact]
    public async Task Only_the_poll_owner_can_grade()
    {
        var (_, poll, answer) = await AnsweredExamAsync();
        using var stranger = ClientFor(await RegisterCreatorAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, (await ScoreAsync(Anonymous, poll.Id, answer.Id, 10)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ScoreAsync(stranger, poll.Id, answer.Id, 10)).StatusCode);
        Assert.Equal(0, await PointsAsync(poll.Id, "Ada"));
    }

    [Fact]
    public async Task An_answer_from_another_poll_is_not_found()
    {
        var (owner, _, answer) = await AnsweredExamAsync();
        var other = await CreatePollAsync(owner, ExamPoll());

        Assert.Equal(HttpStatusCode.NotFound, (await ScoreAsync(owner, other.Id, answer.Id, 10)).StatusCode);
    }

    [Fact]
    public async Task Grades_from_several_answers_add_up_for_one_participant()
    {
        var (owner, poll, first) = await AnsweredExamAsync();

        await PostAsync(Anonymous, $"/api/polls/{poll.Id}/open-answers",
            new SubmitOpenAnswerRequest(0, "And one more thought", "Ada"));

        var answers = await ReadAsync<Application.Common.PagedResult<OpenAnswerDto>>(
            await owner.GetAsync($"/api/polls/{poll.Id}/open-answers"));
        var second = answers.Items.Single(a => a.Id != first.Id);

        (await ScoreAsync(owner, poll.Id, first.Id, 10)).EnsureSuccessStatusCode();
        (await ScoreAsync(owner, poll.Id, second.Id, 7)).EnsureSuccessStatusCode();

        Assert.Equal(17, await PointsAsync(poll.Id, "Ada"));

        var leaderboard = await ReadAsync<List<ScoreEntry>>(
            await Anonymous.GetAsync($"/api/scores?pollId={poll.Id}"));
        Assert.Equal(17, leaderboard.Single(e => e.UserName == "Ada").Points);
    }

    private static Task<HttpResponseMessage> ScoreAsync(HttpClient client, Guid pollId, Guid answerId, int? score) =>
        client.PutAsJsonAsync($"/api/polls/{pollId}/open-answers/{answerId}/score", new ScoreOpenAnswerRequest(score));

    private async Task<int> PointsAsync(Guid pollId, string userName)
    {
        await using var db = CreateDbContext();
        return await db.Scores.AsNoTracking()
            .Where(s => s.PollId == pollId && s.UserName == userName)
            .Select(s => s.Points)
            .SingleOrDefaultAsync();
    }

    private async Task<(HttpClient Owner, PollDto Poll, OpenAnswerDto Answer)> AnsweredExamAsync()
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner, ExamPoll());
        await ActivateAsync(owner, poll.Id);

        var submitted = await PostAsync(Anonymous, $"/api/polls/{poll.Id}/open-answers",
            new SubmitOpenAnswerRequest(0, "Because the server owns the clock", "Ada"));
        submitted.EnsureSuccessStatusCode();

        return (owner, poll, await ReadAsync<OpenAnswerDto>(submitted));
    }

    private static CreatePollRequest ExamPoll() => new(
        "Written exam",
        PollType.Exam,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "Explain why the countdown belongs on the server",
                ImageUrl: null,
                TimeLimit: 600,
                QuestionType: QuestionType.Open,
                AllowMultiple: false,
                CorrectOptionIndex: null,
                CorrectAnswer: null,
                Points: 30,
                MaxWords: null,
                WordCloudConfig: null,
                Options: []),
        ]);
}
