namespace OpenQuiz.Domain.Entities;

/// <summary>
/// Metadata for a file on disk under <c>Media:RootPath</c>. The bytes live
/// next to the API, not in SQL, so a self-hosted volume is the whole store.
/// </summary>
public class MediaFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerUserId { get; set; }
    public User Owner { get; set; } = null!;
    public string ContentType { get; set; } = string.Empty;
    public string Extension { get; set; } = string.Empty;
    public long ByteSize { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
