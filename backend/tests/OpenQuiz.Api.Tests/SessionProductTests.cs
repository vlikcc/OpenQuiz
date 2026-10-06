using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.QuestionBank;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class SessionProductTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Join_code_resolves_the_same_poll()
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var created = await CreatePollAsync(owner);

        Assert.False(string.IsNullOrEmpty(created.JoinCode));
        Assert.Equal(6, created.JoinCode!.Length);

        var byCode = await Anonymous.GetAsync($"/api/polls/code/{created.JoinCode}");
        byCode.EnsureSuccessStatusCode();
        var poll = await ReadAsync<PollDto>(byCode);
        Assert.Equal(created.Id, poll.Id);
        Assert.Null(poll.ResultsShareToken);
    }

    [Fact]
    public async Task Collaborator_can_step_but_cannot_delete()
    {
        var ownerAuth = await RegisterCreatorAsync();
        var helperAuth = await RegisterAsync();
        var owner = ClientFor(ownerAuth);
        var helper = ClientFor(helperAuth);
        var poll = await CreatePollAsync(owner);

        var added = await owner.PostAsJsonAsync($"/api/polls/{poll.Id}/collaborators",
            new AddCollaboratorRequest(helperAuth.User.Email));
        added.EnsureSuccessStatusCode();

        var activated = await helper.PostAsync($"/api/polls/{poll.Id}/activate", null);
        activated.EnsureSuccessStatusCode();

        var next = await helper.PostAsync($"/api/polls/{poll.Id}/next-question", null);
        next.EnsureSuccessStatusCode();

        var delete = await helper.DeleteAsync($"/api/polls/{poll.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
    }

    [Fact]
    public async Task Media_rejects_non_images_and_accepts_jpeg()
    {
        var owner = ClientFor(await RegisterCreatorAsync());

        using var exe = new ByteArrayContent("MZ"u8.ToArray());
        exe.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        using var bad = new MultipartFormDataContent();
        bad.Add(exe, "file", "payload.exe");
        var rejected = await owner.PostAsync("/api/media", bad);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);

        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00 };
        using var jpeg = new ByteArrayContent(jpegBytes);
        jpeg.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        using var good = new MultipartFormDataContent();
        good.Add(jpeg, "file", "q.jpg");
        var uploaded = await owner.PostAsync("/api/media", good);
        uploaded.EnsureSuccessStatusCode();

        var body = await uploaded.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var id = body.GetProperty("id").GetGuid();
        var fetched = await Anonymous.GetAsync($"/api/media/{id}");
        fetched.EnsureSuccessStatusCode();
        Assert.Equal("image/jpeg", fetched.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Shared_results_are_404_until_the_poll_has_ended()
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var poll = await CreatePollAsync(owner);
        await ActivateAsync(owner, poll.Id);

        var enabled = await owner.PostAsync($"/api/polls/{poll.Id}/results-share", null);
        enabled.EnsureSuccessStatusCode();
        var sharing = await ReadAsync<PollDto>(enabled);
        Assert.False(string.IsNullOrEmpty(sharing.ResultsShareToken));

        var live = await Anonymous.GetAsync($"/api/polls/shared/{sharing.ResultsShareToken}");
        Assert.Equal(HttpStatusCode.NotFound, live.StatusCode);

        (await owner.PostAsync($"/api/polls/{poll.Id}/end", null)).EnsureSuccessStatusCode();
        var ended = await Anonymous.GetAsync($"/api/polls/shared/{sharing.ResultsShareToken}");
        ended.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Bank_item_can_be_copied_into_a_new_poll()
    {
        var owner = ClientFor(await RegisterCreatorAsync());
        var sample = SampleQuiz().Questions[0];
        var saved = await owner.PostAsJsonAsync("/api/question-bank", new SaveQuestionBankItemRequest(
            sample.Text, sample.ImageUrl, sample.TimeLimit, sample.QuestionType, sample.AllowMultiple,
            sample.CorrectOptionIndex, sample.CorrectAnswer, sample.Points, sample.MaxWords,
            sample.WordCloudConfig, sample.Options));
        saved.EnsureSuccessStatusCode();
        var item = await ReadAsync<QuestionBankItemDto>(saved);

        var created = await CreatePollAsync(owner, new CreatePollRequest(
            "From bank",
            PollType.Quiz,
            [
                new QuestionInput(0, item.Text, item.ImageUrl, item.TimeLimit, item.QuestionType,
                    item.AllowMultiple, item.CorrectOptionIndex, item.CorrectAnswer, item.Points,
                    item.MaxWords, item.WordCloudConfig,
                    item.Options.Select(o => new OptionInput(o.OrderIndex, o.Text)).ToList()),
            ]));
        Assert.Single(created.Questions);
        Assert.Equal(item.Text, created.Questions[0].Text);
    }

    [Fact]
    public async Task Scheduler_activates_a_waiting_poll_whose_start_has_passed()
    {
        var auth = await RegisterCreatorAsync();
        var owner = ClientFor(auth);
        var poll = await CreatePollAsync(owner);

        await using (var db = CreateDbContext())
        {
            var row = await db.Polls.FirstAsync(p => p.Id == poll.Id);
            row.ScheduledStartAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var polls = scope.ServiceProvider.GetRequiredService<IPollService>();
            await polls.ProcessScheduledAsync(CancellationToken.None);
        }

        var fresh = await ReadAsync<PollDto>(await owner.GetAsync($"/api/polls/{poll.Id}"));
        Assert.Equal(PollStatus.Live, fresh.Status);
    }
}
