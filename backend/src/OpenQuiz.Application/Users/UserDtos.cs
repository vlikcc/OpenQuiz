namespace OpenQuiz.Application.Users;

public record AuthorizedUserDto(string Email, DateTime AddedAt, string? AddedBy);

public record RegisteredUserDto(Guid Id, string Email, string? DisplayName, DateTime CreatedAt, bool CanCreate);

public record AddAuthorizedUserRequest(string Email);
