namespace OpenQuiz.Application.Branding;

public record BrandingDto(
    string? LogoUrl,
    string? PrimaryColor,
    string? AccentColor,
    bool HideOpenQuizBranding,
    string? JoinMessage)
{
    /// <summary>
    /// What a voter sees when the host has no custom branding, or their plan
    /// no longer includes it. The join screen uses the product defaults.
    /// </summary>
    public static readonly BrandingDto Empty = new(null, null, null, false, null);
}

public record UpdateBrandingRequest(
    string? LogoUrl,
    string? PrimaryColor,
    string? AccentColor,
    bool HideOpenQuizBranding,
    string? JoinMessage);
