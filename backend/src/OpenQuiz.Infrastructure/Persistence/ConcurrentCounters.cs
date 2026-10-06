using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace OpenQuiz.Infrastructure.Persistence;

/// <summary>
/// Helpers for counters that several requests bump at once. Reading a row,
/// adding to it in memory and saving loses updates under load: two correct
/// answers arriving together both read the same total and both write the same
/// result. These push the arithmetic into the UPDATE statement so the database
/// serialises it.
/// </summary>
public static class ConcurrentCounters
{
    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    /// <summary>
    /// Runs <paramref name="increment"/>, falling back to <paramref name="insert"/>
    /// when the counter row does not exist yet. A concurrent caller may create
    /// that row first, in which case the unique index rejects our insert and the
    /// increment is retried against the row they created.
    /// </summary>
    public static async Task IncrementOrCreateAsync(
        Func<CancellationToken, Task<int>> increment,
        Func<CancellationToken, Task> insert,
        CancellationToken ct)
    {
        if (await increment(ct) > 0) return;

        try
        {
            await insert(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            await increment(ct);
        }
    }

    /// <summary>
    /// Retries a read-modify-write whose entity carries a row version (PostgreSQL's
    /// <c>xmin</c>, which changes on every update). EF adds
    /// the version to the UPDATE's WHERE clause, so a losing writer sees zero
    /// affected rows and throws instead of silently overwriting.
    /// </summary>
    public static async Task<T> RetryOnConcurrencyAsync<T>(
        Func<CancellationToken, Task<T>> attempt,
        int maxAttempts,
        CancellationToken ct)
    {
        for (var remaining = maxAttempts; ; remaining--)
        {
            try
            {
                return await attempt(ct);
            }
            catch (DbUpdateConcurrencyException) when (remaining > 1)
            {
                // Someone else moved the poll on between our read and write.
                // Re-read and reapply, which is what the operator intended.
            }
        }
    }
}
