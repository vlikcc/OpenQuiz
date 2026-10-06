using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Billing;
using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// Insert-first webhook idempotency and the signature/size/provider gates
/// around <c>PaymentWebhookController</c>. A signed event must change the
/// plan on the very next request with no re-login.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class WebhookIdempotencyTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
        ["Billing:Provider"] = "manual",
        ["Billing:Prices:pro:ProviderPriceId"] = "price_pro_test",
        ["Billing:Prices:pro:Monthly"] = "199",
        ["Billing:Currency"] = "TRY",
    };

    [Fact]
    public async Task A_signed_subscription_event_moves_the_account_onto_the_mapped_plan()
    {
        var auth = await RegisterOnPlanAsync("free");
        using var client = ClientFor(auth);

        var response = await PostWebhookAsync(new
        {
            eventId = "evt_upgrade_1",
            type = WebhookEventTypes.SubscriptionUpdated,
            providerPriceId = "price_pro_test",
            providerSubscriptionId = "sub_1",
            providerCustomerId = "cus_1",
            clientReferenceId = auth.User.Id.ToString(),
            currentPeriodEnd = DateTime.UtcNow.AddMonths(1),
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var me = await ReadAsync<BillingMeDto>(await client.GetAsync("/api/billing/me"));
        Assert.Equal("pro", me.PlanCode);
        Assert.Equal(nameof(PlanSource.Provider), me.Source);
    }

    [Fact]
    public async Task The_same_event_id_is_applied_once()
    {
        var auth = await RegisterOnPlanAsync("free");

        var payload = new
        {
            eventId = "evt_once",
            type = WebhookEventTypes.InvoicePaid,
            providerPriceId = "price_pro_test",
            providerPaymentId = "pay_once",
            amount = 199m,
            currency = "TRY",
            clientReferenceId = auth.User.Id.ToString(),
        };

        (await PostWebhookAsync(payload)).EnsureSuccessStatusCode();
        var second = await PostWebhookAsync(payload);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        await using var db = CreateDbContext();
        Assert.Equal(1, await db.PaymentTransactions.CountAsync(t => t.ProviderPaymentId == "pay_once"));
        var account = await db.BillingAccounts.SingleAsync(a => a.OwnerUserId == auth.User.Id);
        Assert.Equal("pro", account.PlanCode);
    }

    [Fact]
    public async Task A_forged_signature_is_rejected_without_changing_the_plan()
    {
        var auth = await RegisterOnPlanAsync("free");

        var response = await PostWebhookAsync(new
        {
            eventId = "evt_forged",
            type = WebhookEventTypes.SubscriptionUpdated,
            providerPriceId = "price_pro_test",
            clientReferenceId = auth.User.Id.ToString(),
        }, signature: "nope");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        await using var db = CreateDbContext();
        var account = await db.BillingAccounts.SingleAsync(a => a.OwnerUserId == auth.User.Id);
        Assert.Equal("free", account.PlanCode);
    }

    [Fact]
    public async Task An_unknown_provider_is_not_found()
    {
        var response = await Anonymous.PostAsync(
            "/api/billing/webhooks/not-a-provider",
            new StringContent("{}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task An_oversized_body_is_rejected()
    {
        var bytes = new byte[(256 * 1024) + 1];
        using var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

        var response = await Anonymous.PostAsync("/api/billing/webhooks/test", content);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task An_unmapped_price_id_does_not_grant_a_plan()
    {
        var auth = await RegisterOnPlanAsync("free");

        (await PostWebhookAsync(new
        {
            eventId = "evt_unknown_price",
            type = WebhookEventTypes.SubscriptionUpdated,
            providerPriceId = "price_we_do_not_sell",
            clientReferenceId = auth.User.Id.ToString(),
        })).EnsureSuccessStatusCode();

        await using var db = CreateDbContext();
        var account = await db.BillingAccounts.SingleAsync(a => a.OwnerUserId == auth.User.Id);
        Assert.Equal("free", account.PlanCode);
    }

    private async Task<HttpResponseMessage> PostWebhookAsync(object body, string signature = TestPaymentProvider.ValidSignature)
    {
        var json = JsonSerializer.Serialize(body);
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/billing/webhooks/test")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        request.Headers.TryAddWithoutValidation(TestPaymentProvider.SignatureHeader, signature);
        return await Anonymous.SendAsync(request);
    }
}
