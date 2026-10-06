using System.Text;

namespace OpenQuiz.Application.WordCloud;

/// <summary>
/// A small Turkish and English profanity list for word cloud questions. A cloud
/// is projected on a wall in front of a room, so the one word nobody wants up
/// there is exactly the one somebody will send.
///
/// The list is deliberately conservative and matched whole-word rather than by
/// substring: a filter that swallows innocent words is worse than one that
/// misses the occasional creative spelling, and an organiser can always add to
/// the per-question blacklist.
/// </summary>
internal static class ProfanityList
{
    private static readonly HashSet<string> Words = new(StringComparer.Ordinal)
    {
        // Turkish
        "amcik", "amcık", "amina", "amına", "amk", "aq", "bok", "çük", "cuk",
        "gavat", "göt", "got", "gotveren", "götveren", "hasiktir", "hassiktir",
        "kahpe", "orospu", "oç", "piç", "pic", "pezevenk", "sik", "sikik",
        "sikim", "sikiyim", "siktir", "şerefsiz", "serefsiz", "yarrak", "yarak",
        "amq",

        // English
        "arse", "arsehole", "asshole", "bastard", "bitch", "bollocks", "bullshit",
        "cock", "cunt", "dick", "dickhead", "dumbass", "fag", "faggot", "fuck",
        "fucked", "fucker", "fucking", "jackass", "motherfucker", "nigga",
        "nigger", "prick", "pussy", "shit", "shitty", "slut", "twat", "wanker",
        "whore"
    };

    /// <summary>The same words with every repeated letter squeezed out.</summary>
    private static readonly HashSet<string> Squeezed =
        new(Words.Select(Squeeze), StringComparer.Ordinal);

    private static readonly char[] Separators = [' ', '-', '\''];

    public static bool Matches(string normalizedTerm)
    {
        if (IsListed(normalizedTerm)) return true;

        foreach (var token in normalizedTerm.Split(Separators, StringSplitOptions.RemoveEmptyEntries))
        {
            if (IsListed(token)) return true;
        }

        return false;
    }

    private static bool IsListed(string part)
    {
        var folded = Fold(part);
        if (folded.Length == 0) return false;
        if (Words.Contains(folded)) return true;

        // Stretching a letter out ("shiiiit") is a deliberate dodge, so the
        // squeezed comparison is only reached by words that show one. Otherwise
        // "as" would be read as a squeezed obscenity.
        return HasStretchedLetter(folded) && Squeezed.Contains(Squeeze(folded));
    }

    private static bool HasStretchedLetter(string folded)
    {
        for (var i = 2; i < folded.Length; i++)
        {
            if (folded[i] == folded[i - 1] && folded[i] == folded[i - 2]) return true;
        }

        return false;
    }

    private static string Squeeze(string word)
    {
        var squeezed = new StringBuilder(word.Length);
        foreach (var c in word)
        {
            if (squeezed.Length == 0 || squeezed[^1] != c) squeezed.Append(c);
        }

        return squeezed.ToString();
    }

    /// <summary>
    /// Undoes the usual ways a filter gets dodged: digits standing in for
    /// letters and punctuation sprinkled through the word. Turkish diacritics
    /// are left alone on purpose — folding "şık" to "sik" would ban a perfectly
    /// ordinary word.
    /// </summary>
    private static string Fold(string term)
    {
        var folded = new StringBuilder(term.Length);

        foreach (var raw in term)
        {
            var c = raw switch
            {
                '0' => 'o',
                '1' or '!' or '|' => 'i',
                '3' => 'e',
                '4' or '@' => 'a',
                '5' or '$' => 's',
                '7' => 't',
                _ => raw
            };

            if (char.IsLetter(c)) folded.Append(c);
        }

        return folded.ToString();
    }
}
