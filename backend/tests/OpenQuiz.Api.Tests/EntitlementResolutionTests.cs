using System.Net.Http.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Auth;
using OpenQuiz.Application.Billing;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// <c>PlanResolver</c>'s branches: billing on resolves a real
/// <c>BillingAccount</c> row, an unknown plan code falls back to unlimited
/// rather than failing the request, and — the whole reason plan data is kept
/// out of the JWT (see <c>EntitlementService</c>'s doc comment) — an admin's
/// plan change is visible on the very next request with no re-login.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class EntitlementResolutionTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
    };

    [Fact]
    public async Task A_freshly_registered_user_resolves_to_the_deployment_default_plan()
    {
        using var client = ClientFor(await RegisterCreatorAsync());

        var response = await client.GetAsync("/api/billing/me");
        response.EnsureSuccessStatusCode();
        var me = await ReadAsync<BillingMeDto>(response);

        Assert.Equal("free", me.PlanCode);
    }

    [Fact]
    public async Task An_unknown_plan_code_falls_back_to_unlimited_instead_of_failing_the_request()
    {
        var auth = await RegisterCreatorAsync();
        await using (var db = CreateDbContext())
        {
            db.BillingAccounts.Add(new BillingAccount
            {
                OwnerUserId = auth.User.Id,
                PlanCode = "retired-plan-code-nobody-sells-anymore",
                Source = PlanSource.Manual,
                Status = SubscriptionStatus.Active,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        using var client = ClientFor(auth);
        var response = await client.GetAsync("/api/billing/me");
        response.EnsureSuccessStatusCode();
        var me = await ReadAsync<BillingMeDto>(response);

        Assert.Equal(EntitlementKeys.Unlimited, me.Values[EntitlementKeys.LimitActivePolls]);
    }

    [Fact]
    public async Task An_admins_plan_change_is_visible_on_the_targets_very_next_request()
    {
        var target = await RegisterOnPlanAsync("free");

        var adminEmail = UniqueEmail("admin");
        var adminAuth = await RegisterAsync(adminEmail);
        await using (var db = CreateDbContext())
        {
            var admin = await db.Users.FindAsync(adminAuth.User.Id);
            admin!.IsAdmin = true;
            await db.SaveChangesAsync();
        }

        // IsAdmin travels on the JWT, so *this* re-login is unavoidable — it is
        // what the test is deliberately NOT doing to the target account below.
        var loginResponse = await PostAsync(Anonymous, "/api/auth/login", new LoginRequest(adminEmail, ValidPassword));
        loginResponse.EnsureSuccessStatusCode();
        using var adminClient = ClientFor(await ReadAsync<AuthResponse>(loginResponse));

        using (var targetBefore = ClientFor(target))
        {
            var beforeResponse = await targetBefore.GetAsync("/api/billing/me");
            beforeResponse.EnsureSuccessStatusCode();
            var before = await ReadAsync<BillingMeDto>(beforeResponse);
            Assert.Equal("free", before.PlanCode);
        }

        var setPlan = await adminClient.PutAsJsonAsync(
            $"/api/billing/accounts/{target.User.Id}/plan", new SetAccountPlanRequest("pro"));
        setPlan.EnsureSuccessStatusCode();

        // Same access token as before the plan change — no refresh, no re-login.
        using var targetAfter = ClientFor(target);
        var afterResponse = await targetAfter.GetAsync("/api/billing/me");
        afterResponse.EnsureSuccessStatusCode();
        var after = await ReadAsync<BillingMeDto>(afterResponse);
        Assert.Equal("pro", after.PlanCode);
    }
}
