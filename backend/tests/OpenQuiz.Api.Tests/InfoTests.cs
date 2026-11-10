using System.Text.Json;
using OpenQuiz.Api.Tests.Infrastructure;

namespace OpenQuiz.Api.Tests;

/// <summary>
/// The join QR is built in the browser, which only knows the address the
/// presenter typed. On localhost that address is useless to a phone, so the
/// configured public address has to be readable without an account.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class InfoTests(DatabaseFixture sql) : ApiTestBase(sql)
{
    [Fact]
    public async Task Anyone_can_read_the_public_url()
    {
        var response = await Anonymous.GetAsync("/api/info");

        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("https://openquiz.test", body.RootElement.GetProperty("publicUrl").GetString());
    }
}
