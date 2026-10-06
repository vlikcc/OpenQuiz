namespace OpenQuiz.Application.Common;

public class AppException : Exception
{
    public int StatusCode { get; }
    public string ErrorCode { get; }

    /// <summary>
    /// Machine-readable detail beyond the message — e.g. which limit was hit
    /// and what plan would raise it — surfaced to callers via ProblemDetails
    /// extensions. Null for the common error paths that don't need them.
    /// </summary>
    public IReadOnlyDictionary<string, object?>? Extensions { get; }

    public AppException(
        string errorCode,
        string message,
        int statusCode = 400,
        IReadOnlyDictionary<string, object?>? extensions = null) : base(message)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
        Extensions = extensions;
    }
}

public static class Errors
{
    public static AppException NotFound(string what) => new("not_found", $"{what} not found.", 404);
    public static AppException Forbidden(string msg = "Forbidden.") => new("forbidden", msg, 403);
    public static AppException Unauthorized(string msg = "Unauthorized.") => new("unauthorized", msg, 401);
    public static AppException Conflict(string msg) => new("conflict", msg, 409);
    public static AppException Validation(string msg) => new("validation", msg, 400);
    public static AppException ServiceUnavailable(string msg) => new("service_unavailable", msg, 503);

    /// <summary>
    /// A plan's numeric limit (active polls, participants, sessions/month,
    /// questions/poll) was reached. 402 rather than 403: this codebase already
    /// overloads 403 for ownership failures (<c>PollService.EnsureOwner</c>),
    /// and the frontend needs to tell "not yours" from "upgrade your plan"
    /// apart without parsing the message.
    /// </summary>
    public static AppException PlanLimitExceeded(string limitKey, long limit, long attempted, string? requiredPlan, string msg) =>
        new("plan_limit_exceeded", msg, 402, new Dictionary<string, object?>
        {
            ["limitKey"] = limitKey,
            ["limit"] = limit,
            ["attempted"] = attempted,
            ["requiredPlan"] = requiredPlan,
        });

    /// <summary>A plan-gated feature (export, branding, an advanced content type) was used by a plan that doesn't include it.</summary>
    public static AppException PlanFeatureRequired(string featureKey, string? requiredPlan, string msg) =>
        new("plan_feature_required", msg, 402, new Dictionary<string, object?>
        {
            ["featureKey"] = featureKey,
            ["requiredPlan"] = requiredPlan,
        });
}
