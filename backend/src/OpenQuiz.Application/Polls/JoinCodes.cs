using System.Security.Cryptography;

namespace OpenQuiz.Application.Polls;

/// <summary>
/// Short room codes shown on a projector. Ambiguous glyphs (0/O, 1/I) are
/// omitted so a student reading them off a wall is less likely to mistype.
/// </summary>
public static class JoinCodes
{
    public const int Length = 6;
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string Generate()
    {
        Span<char> chars = stackalloc char[Length];
        Span<byte> bytes = stackalloc byte[Length];
        RandomNumberGenerator.Fill(bytes);
        for (var i = 0; i < Length; i++)
            chars[i] = Alphabet[bytes[i] % Alphabet.Length];
        return new string(chars);
    }

    public static string Normalize(string? raw) => (raw ?? string.Empty).Trim().ToUpperInvariant();
}
