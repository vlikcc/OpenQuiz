using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Branding;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Custom branding is a paid write. The anonymous poll read must not leak a
/// cancelled subscriber's white-label — it follows the creator's *current*
/// entitlements, not whatever row they saved while they were on Pro.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class BrandingGateTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
    };

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static readonly UpdateBrandingRequest Sample = new(
        "https://cdn.example.test/logo.png",
        "#4F46E5",
        "#EC4899",
        true,
        "Welcome to the session");

    [Fact]
    public async Task A_free_plan_cannot_save_branding()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));

        var response = await owner.PutAsJsonAsync("/api/branding", Sample);

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PlanErrorBody>(Json);
        Assert.Equal("plan_feature_required", body!.Title);
        Assert.Equal("branding.custom", body.FeatureKey);
    }

    [Fact]
    public async Task A_pro_plan_can_save_branding_and_voters_see_it()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("pro"));
        var poll = await CreatePollAsync(owner);

        var saved = await ReadAsync<BrandingDto>(await owner.PutAsJsonAsync("/api/branding", Sample));
        Assert.Equal(Sample.LogoUrl, saved.LogoUrl);
        Assert.True(saved.HideOpenQuizBranding);

        var publicBranding = await ReadAsync<BrandingDto>(
            await Anonymous.GetAsync($"/api/polls/{poll.Id}/branding"));

        Assert.Equal(Sample.LogoUrl, publicBranding.LogoUrl);
        Assert.Equal(Sample.JoinMessage, publicBranding.JoinMessage);
        Assert.True(publicBranding.HideOpenQuizBranding);
    }

    [Fact]
    public async Task A_free_creators_poll_returns_empty_branding_to_voters()
    {
        using var owner = ClientFor(await RegisterOnPlanAsync("free"));
        var poll = await CreatePollAsync(owner);

        var branding = await ReadAsync<BrandingDto>(
            await Anonymous.GetAsync($"/api/polls/{poll.Id}/branding"));

        Assert.Null(branding.LogoUrl);
        Assert.False(branding.HideOpenQuizBranding);
        Assert.Null(branding.JoinMessage);
    }

    [Fact]
    public async Task A_missing_poll_is_not_found()
    {
        var response = await Anonymous.GetAsync($"/api/polls/{Guid.NewGuid()}/branding");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private record PlanErrorBody(string Title, string? FeatureKey);
}
