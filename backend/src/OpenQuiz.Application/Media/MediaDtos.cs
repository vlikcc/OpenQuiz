namespace OpenQuiz.Application.Media;

public record MediaFileDto(Guid Id, string Url, string ContentType, long ByteSize);
