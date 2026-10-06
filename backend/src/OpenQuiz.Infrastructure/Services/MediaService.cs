using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Media;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class MediaService : IMediaService
{
    public const long DefaultMaxBytes = 2 * 1024 * 1024;

    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;
    private readonly string _root;
    private readonly int _maxBytes;

    public MediaService(
        OpenQuizDbContext db,
        ICurrentUser user,
        IOptions<MediaOptions> options)
    {
        _db = db;
        _user = user;
        var configured = options.Value.RootPath;
        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "data", "media")
            : configured;
        _maxBytes = options.Value.MaxBytes > 0 ? options.Value.MaxBytes : (int)DefaultMaxBytes;
        Directory.CreateDirectory(_root);
    }

    public async Task<MediaFileDto> UploadAsync(Stream content, string contentType, string fileName, CancellationToken ct)
    {
        if (!_user.IsAuthenticated || _user.UserId is not Guid uid) throw Errors.Unauthorized();
        if (!_user.IsAdmin && !_user.CanCreate) throw Errors.Forbidden("You are not authorized to create polls.");

        await using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length == 0) throw Errors.Validation("The file is empty.");
        if (buffer.Length > _maxBytes) throw Errors.Validation("Images must be 2 MB or smaller.");

        var sniff = buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16));
        var kind = Detect(sniff) ?? throw Errors.Validation("Only JPEG, PNG, WebP and GIF images are allowed.");

        var row = new MediaFile
        {
            OwnerUserId = uid,
            ContentType = kind.ContentType,
            Extension = kind.Extension,
            ByteSize = buffer.Length,
            OriginalFileName = Truncate(fileName, 256),
            CreatedAt = DateTime.UtcNow,
        };
        _db.MediaFiles.Add(row);
        await _db.SaveChangesAsync(ct);

        var path = Path.Combine(_root, row.Id.ToString("N") + kind.Extension);
        buffer.Position = 0;
        await using (var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true))
            await buffer.CopyToAsync(fs, ct);

        return Map(row);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> OpenAsync(Guid id, CancellationToken ct)
    {
        var row = await _db.MediaFiles.FindAsync([id], ct);
        if (row is null) return null;

        var path = Path.Combine(_root, row.Id.ToString("N") + row.Extension);
        if (!File.Exists(path)) return null;

        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
        return (stream, row.ContentType, row.OriginalFileName);
    }

    private static MediaFileDto Map(MediaFile row) =>
        new(row.Id, $"/api/media/{row.Id}", row.ContentType, row.ByteSize);

    private static string Truncate(string name, int max)
    {
        var trimmed = Path.GetFileName(name.Trim());
        if (string.IsNullOrEmpty(trimmed)) return "image";
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    private static ImageKind? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return new("image/jpeg", ".jpg");
        if (header.Length >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47)
            return new("image/png", ".png");
        if (header.Length >= 6 && header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46)
            return new("image/gif", ".gif");
        if (header.Length >= 12 && header[0] == (byte)'R' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'F'
            && header[8] == (byte)'W' && header[9] == (byte)'E' && header[10] == (byte)'B' && header[11] == (byte)'P')
            return new("image/webp", ".webp");
        return null;
    }

    private readonly record struct ImageKind(string ContentType, string Extension);
}
