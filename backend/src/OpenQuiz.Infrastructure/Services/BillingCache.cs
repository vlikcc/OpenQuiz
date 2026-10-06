using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

/// <summary>
/// Plan changes (admin flip or a verified webhook) must be visible on the
/// very next request, not after the 60 s entitlement TTL.
/// </summary>
internal static class BillingCache
{
    public static async Task EvictForUserAsync(
        OpenQuizDbContext db,
        IMemoryCache cache,
        Guid userId,
        CancellationToken ct)
    {
        cache.Remove(EntitlementService.PlanCacheKey(userId));

        var pollIds = await db.Polls.AsNoTracking()
            .Where(p => p.CreatorId == userId)
            .Select(p => p.Id)
            .ToListAsync(ct);
        foreach (var pollId in pollIds)
            cache.Remove(PollCapCache.Key(pollId));
    }
}
