namespace OpenQuiz.Infrastructure.Options;

public class MediaOptions
{
    public const string SectionName = "Media";

    /// <summary>Directory that holds uploaded images. Empty = {ContentRoot}/data/media.</summary>
    public string RootPath { get; set; } = "";

    public int MaxBytes { get; set; } = 2 * 1024 * 1024;
}
