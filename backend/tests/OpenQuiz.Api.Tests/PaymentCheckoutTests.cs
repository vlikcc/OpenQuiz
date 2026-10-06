using System.Net;
using System.Net.Http.Json;
using OpenQuiz.Api.Tests.Infrastructure;
using OpenQuiz.Application.Billing;

namespace OpenQuiz.Api.Tests;

[Collection(DatabaseCollection.Name)]
public class PaymentCheckoutTests(DatabaseFixture sql) : ApiTestBase(sql, Settings)
{
    private static readonly Dictionary<string, string?> Settings = new()
    {
        ["Billing:Enabled"] = "true",
        ["Billing:DefaultPlanCode"] = "free",
        ["Billing:Provider"] = "manual",
        ["App:PublicUrl"] = "https://openquiz.test",
    };

    [Fact]
    public async Task Checkout_returns_the_manual_contact_url_for_a_purchasable_plan()
    {
        using var client = ClientFor(await RegisterOnPlanAsync("free"));

        var response = await client.PostAsJsonAsync("/api/billing/checkout", new CreateCheckoutApiRequest("pro", "monthly"));
        response.EnsureSuccessStatusCode();

        var session = await ReadAsync<CheckoutSessionDto>(response);
        Assert.Contains("billing=contact", session.Url, StringComparison.Ordinal);
        Assert.Contains("plan=pro", session.Url, StringComparison.Ordinal);
        Assert.StartsWith("https://openquiz.test/", session.Url);
    }

    [Fact]
    public async Task Checkout_rejects_a_plan_that_is_not_for_sale()
    {
        using var client = ClientFor(await RegisterOnPlanAsync("free"));

        var response = await client.PostAsJsonAsync("/api/billing/checkout", new CreateCheckoutApiRequest("unlimited", "monthly"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Anonymous_checkout_is_unauthorized()
    {
        var response = await Anonymous.PostAsJsonAsync("/api/billing/checkout", new CreateCheckoutApiRequest("pro", "monthly"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}

[Collection(DatabaseCollection.Name)]
public class PaymentCheckoutDisabledTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Checkout_is_rejected_when_billing_is_off()
    {
        using var client = ClientFor(await RegisterCreatorAsync());

        var response = await client.PostAsJsonAsync("/api/billing/checkout", new CreateCheckoutApiRequest("pro", "monthly"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
