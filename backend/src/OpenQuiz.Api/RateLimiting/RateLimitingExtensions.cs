using System.Globalization;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace OpenQuiz.Api.RateLimiting;

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Participation = "participation";
    public const string Reactions = "reactions";
}

public static class RateLimitingExtensions
{
    public static IServiceCollection AddOpenQuizRateLimiting(
        this IServiceCollection services,
        RateLimitOptions options)
    {
        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = WriteRejectionAsync;

            AddFixedWindow(limiter, RateLimitPolicies.Auth, options.Auth, options.Enabled);
            AddFixedWindow(limiter, RateLimitPolicies.Participation, options.Participation, options.Enabled);
            AddFixedWindow(limiter, RateLimitPolicies.Reactions, options.Reactions, options.Enabled);
        });

        return services;
    }

    private static void AddFixedWindow(
        RateLimiterOptions limiter,
        string policyName,
        RateLimitOptions.WindowOptions window,
        bool enabled)
    {
        limiter.AddPolicy(policyName, context =>
        {
            if (!enabled)
                return RateLimitPartition.GetNoLimiter("disabled");

            return RateLimitPartition.GetFixedWindowLimiter(
                $"{policyName}:{PartitionKey(context)}",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = window.PermitLimit,
                    Window = TimeSpan.FromSeconds(window.WindowSeconds),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                });
        });
    }

    // Signed-in callers get their own bucket; everyone else is bucketed by
    // address, which is the only stable identifier an anonymous voter has.
    private static string PartitionKey(HttpContext context)
    {
        var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userId)) return "user:" + userId;

        return "ip:" + (context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
    }

    private static ValueTask WriteRejectionAsync(OnRejectedContext context, CancellationToken ct)
    {
        var response = context.HttpContext.Response;
        response.ContentType = "application/problem+json";

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString(NumberFormatInfo.InvariantInfo);
        }

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Type = "https://openquiz.local/errors/too_many_requests",
            Title = "too_many_requests",
            Detail = "Too many requests. Please slow down and try again shortly.",
        };

        return new ValueTask(response.WriteAsync(JsonSerializer.Serialize(problem), ct));
    }
}
