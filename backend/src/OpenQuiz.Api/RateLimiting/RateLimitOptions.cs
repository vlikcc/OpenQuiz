namespace OpenQuiz.Api.RateLimiting;

public class RateLimitOptions
{
    public const string SectionName = "RateLimiting";

    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Read the caller address from X-Forwarded-For. Only turn this on when the
    /// API is exclusively reachable through a reverse proxy, otherwise clients
    /// can forge the header and each get their own quota.
    /// </summary>
    public bool TrustForwardedHeaders { get; set; }

    /// <summary>
    /// How many proxies sit between the client and the API, i.e. how many
    /// X-Forwarded-For entries to unwind from the right. 1 when the edge proxy
    /// talks to the API directly (the bundled Caddy); 2 when an outer proxy
    /// forwards to the web container's nginx, which appends its own hop.
    /// </summary>
    public int ForwardLimit { get; set; } = 1;

    /// <summary>Credential endpoints: register, login, refresh, password reset.</summary>
    public WindowOptions Auth { get; set; } = new() { PermitLimit = 10, WindowSeconds = 60 };

    /// <summary>
    /// Participation endpoints: join, votes, open answers, word cloud. A whole
    /// room usually shares one NAT address, so this budget is per venue rather
    /// than per person.
    /// </summary>
    public WindowOptions Participation { get; set; } = new() { PermitLimit = 240, WindowSeconds = 60 };

    /// <summary>Emoji reactions, which are tapped far more often than votes.</summary>
    public WindowOptions Reactions { get; set; } = new() { PermitLimit = 300, WindowSeconds = 60 };

    public class WindowOptions
    {
        public int PermitLimit { get; set; }
        public int WindowSeconds { get; set; }
    }
}
