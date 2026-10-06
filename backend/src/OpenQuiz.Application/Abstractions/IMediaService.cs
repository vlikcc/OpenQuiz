using OpenQuiz.Application.Media;

namespace OpenQuiz.Application.Abstractions;

public interface IMediaService
{
    Task<MediaFileDto> UploadAsync(Stream content, string contentType, string fileName, CancellationToken ct);
    Task<(Stream Stream, string ContentType, string FileName)?> OpenAsync(Guid id, CancellationToken ct);
}
