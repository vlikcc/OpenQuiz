using System.Text.Json;

namespace OpenQuiz.Application.WordCloud;

/// <summary>
/// How a word cloud question moderates what the room sends it. The settings are
/// authored per question and stored as JSON on <c>Question.WordCloudConfig</c>,
/// so a poll written before this existed simply gets the defaults.
/// </summary>
public sealed record WordCloudSettings
{
    public static readonly WordCloudSettings Default = new();

    /// <summary>Falls back to the question's own MaxWords column when null.</summary>
    public int? MaxWordsPerUser { get; init; }

    public int MinTermLength { get; init; } = 2;

    public int MaxTermLength { get; init; } = 64;

    /// <summary>Terms the organiser has ruled out for this question.</summary>
    public IReadOnlyList<string> Blacklist { get; init; } = [];

    /// <summary>How many terms the cloud shows. The tail is still recorded.</summary>
    public int TopN { get; init; } = 50;

    /// <summary>
    /// When false — the default — a participant's second helping of the same term
    /// is ignored, so one person cannot inflate a word by sending it repeatedly.
    /// </summary>
    public bool AllowDuplicatesFromSameUser { get; init; }

    /// <summary>The built-in profanity list, on top of the per-question blacklist.</summary>
    public bool ProfanityFilter { get; init; } = true;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Reads settings off a question. Anything unparseable falls back to the
    /// defaults rather than failing the submission: a malformed config should
    /// not take a live room down.
    /// </summary>
    public static WordCloudSettings Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Default;

        try
        {
            return (JsonSerializer.Deserialize<WordCloudSettings>(json, Json) ?? Default).Sanitized();
        }
        catch (JsonException)
        {
            return Default;
        }
    }

    private WordCloudSettings Sanitized()
    {
        var max = Math.Clamp(MaxTermLength, 1, 64);

        return this with
        {
            MaxWordsPerUser = MaxWordsPerUser is int n ? Math.Clamp(n, 1, 20) : null,
            MinTermLength = Math.Clamp(MinTermLength, 1, max),
            MaxTermLength = max,
            TopN = Math.Clamp(TopN, 1, 500),
            Blacklist = [.. Blacklist
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Select(w => w.Trim().ToLowerInvariant())
                .Distinct()
                .Take(500)]
        };
    }

    /// <summary>Whether a normalized term is one the organiser has ruled out.</summary>
    public bool IsBlocked(string normalizedTerm) =>
        Blacklist.Contains(normalizedTerm) || (ProfanityFilter && ProfanityList.Matches(normalizedTerm));
}
