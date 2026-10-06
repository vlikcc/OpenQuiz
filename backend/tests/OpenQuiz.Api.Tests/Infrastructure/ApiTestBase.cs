using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using OpenQuiz.Application.Auth;
using OpenQuiz.Application.Polls;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Api.Tests.Infrastructure;

public abstract class ApiTestBase : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly DatabaseFixture _sql;
    private readonly Dictionary<string, string?> _settings;

    protected ApiTestBase(DatabaseFixture sql, IDictionary<string, string?>? settings = null)
    {
        _sql = sql;
        _settings = settings is null ? [] : new Dictionary<string, string?>(settings);
    }

    protected OpenQuizApiFactory Api { get; private set; } = null!;

    /// <summary>A client with no credentials, i.e. an audience member.</summary>
    protected HttpClient Anonymous { get; private set; } = null!;

    public Task InitializeAsync()
    {
        Api = new OpenQuizApiFactory(_sql.ConnectionString, _settings);
        Anonymous = Api.CreateClient();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        Anonymous.Dispose();
        await Api.DisposeAsync();
    }

    protected OpenQuizDbContext CreateDbContext() => _sql.CreateDbContext();

    /// <summary>For tests that need a second host pointed at the same database.</summary>
    protected string ConnectionString => _sql.ConnectionString;

    protected static string UniqueEmail(string prefix = "user") => $"{prefix}-{Guid.NewGuid():N}@openquiz.test";

    protected const string ValidPassword = "Sup3rSecret!";

    protected async Task<AuthResponse> RegisterAsync(string? email = null, string password = ValidPassword)
    {
        var response = await Anonymous.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest(email ?? UniqueEmail(), password, "Test User"),
            Json);

        response.EnsureSuccessStatusCode();
        return await ReadAsync<AuthResponse>(response);
    }

    /// <summary>
    /// A registered account that is allowed to author polls. Authoring rights
    /// travel in the token, so the account has to sign in again after an admin
    /// grants them.
    /// </summary>
    protected async Task<AuthResponse> RegisterCreatorAsync(string? email = null)
    {
        email ??= UniqueEmail("creator");
        var auth = await RegisterAsync(email);

        await using (var db = CreateDbContext())
        {
            var user = await db.Users.FindAsync(auth.User.Id);
            user!.CanCreate = true;
            await db.SaveChangesAsync();
        }

        var response = await Anonymous.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, ValidPassword), Json);
        response.EnsureSuccessStatusCode();
        return await ReadAsync<AuthResponse>(response);
    }

    /// <summary>
    /// A registered, creator-authorized account whose <c>BillingAccount</c> is
    /// pinned to <paramref name="planCode"/> directly in the database — no
    /// re-login, unlike <see cref="RegisterCreatorAsync"/>. That is the point:
    /// plan enforcement reads the database on every request rather than a JWT
    /// claim (see <c>EntitlementService</c>), so a plan change must take effect
    /// on the caller's very next request.
    /// </summary>
    protected async Task<AuthResponse> RegisterOnPlanAsync(string planCode, string? email = null)
    {
        var auth = await RegisterCreatorAsync(email);

        await using (var db = CreateDbContext())
        {
            db.BillingAccounts.Add(new BillingAccount
            {
                OwnerUserId = auth.User.Id,
                PlanCode = planCode,
                Source = PlanSource.Manual,
                Status = SubscriptionStatus.Active,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        return auth;
    }

    protected HttpClient ClientFor(AuthResponse auth)
    {
        var client = Api.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    protected static CreatePollRequest SampleQuiz(string title = "Integration quiz") => new(
        title,
        PollType.Quiz,
        [
            new QuestionInput(
                OrderIndex: 0,
                Text: "Which planet is closest to the sun?",
                ImageUrl: null,
                TimeLimit: 30,
                QuestionType: QuestionType.MultipleChoice,
                AllowMultiple: false,
                CorrectOptionIndex: 1,
                CorrectAnswer: null,
                Points: 10,
                MaxWords: null,
                WordCloudConfig: null,
                Options:
                [
                    new OptionInput(0, "Venus"),
                    new OptionInput(1, "Mercury"),
                    new OptionInput(2, "Mars"),
                ]),
            new QuestionInput(
                OrderIndex: 1,
                Text: "Which gas dominates the atmosphere?",
                ImageUrl: null,
                TimeLimit: 30,
                QuestionType: QuestionType.MultipleChoice,
                AllowMultiple: false,
                CorrectOptionIndex: 0,
                CorrectAnswer: null,
                Points: 10,
                MaxWords: null,
                WordCloudConfig: null,
                Options:
                [
                    new OptionInput(0, "Nitrogen"),
                    new OptionInput(1, "Oxygen"),
                ]),
        ]);

    protected static async Task<PollDto> CreatePollAsync(HttpClient owner, CreatePollRequest? request = null)
    {
        var response = await owner.PostAsJsonAsync("/api/polls", request ?? SampleQuiz(), Json);
        response.EnsureSuccessStatusCode();
        return await ReadAsync<PollDto>(response);
    }

    protected static async Task<PollDto> ActivateAsync(HttpClient owner, Guid pollId)
    {
        var response = await owner.PostAsync($"/api/polls/{pollId}/activate", null);
        response.EnsureSuccessStatusCode();
        return await ReadAsync<PollDto>(response);
    }

    protected static Task<HttpResponseMessage> PostAsync<T>(HttpClient client, string url, T body) =>
        client.PostAsJsonAsync(url, body, Json);

    protected static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<T>(Json)
        ?? throw new InvalidOperationException($"{typeof(T).Name} body was null.");
}
