using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Application.Common;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

/// <summary>
/// The single entry point enforcement code calls. Deliberately does not read
/// plan or limits from the JWT: this repo's own tests already show what
/// staleness looks like when authorization data lives in a token
/// (<c>ApiTestBase.RegisterCreatorAsync</c> has to re-login for a fresh
/// <c>canCreate</c> claim to take effect). A 15-minute dead zone is a support
/// ticket waiting to happen the moment it starts at "I just paid". Instead,
/// every read goes through a short-lived <see cref="IMemoryCache"/> entry and
/// is memoized again for the lifetime of this scoped instance, so a request
/// that asks five different questions about the caller's plan reads it once.
/// </summary>
public class EntitlementService : IEntitlementService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;
    private readonly IPlanResolver _resolver;
    private readonly IMemoryCache _cache;
    private readonly ILogger<EntitlementService> _logger;

    private ResolvedPlan? _currentUserPlan;
    private EntitlementSet? _currentUserSet;

    public EntitlementService(
        OpenQuizDbContext db,
        ICurrentUser user,
        IPlanResolver resolver,
        IMemoryCache cache,
        ILogger<EntitlementService> logger)
    {
        _db = db; _user = user; _resolver = resolver; _cache = cache; _logger = logger;
    }

    public async Task<EntitlementSet> ForCurrentUserAsync(CancellationToken ct)
    {
        if (_currentUserSet is not null) return _currentUserSet;
        if (_user.UserId is not Guid uid) throw Errors.Unauthorized();

        _currentUserPlan ??= await ResolveCachedAsync(uid, ct);
        _currentUserSet = await BuildSetAsync(_currentUserPlan, ct);
        return _currentUserSet;
    }

    public async Task<EntitlementSet> ForUserAsync(Guid userId, CancellationToken ct)
    {
        var resolved = await ResolveCachedAsync(userId, ct);
        return await BuildSetAsync(resolved, ct);
    }

    public async Task EnsureFeatureAsync(string featureKey, CancellationToken ct)
    {
        var set = await ForCurrentUserAsync(ct);
        if (set.Has(featureKey)) return;

        throw Errors.PlanFeatureRequired(featureKey, RequiredPlanFor(featureKey), "Your plan does not include this feature.");
    }

    public async Task EnsureWithinLimitAsync(string limitKey, long attemptedTotal, CancellationToken ct)
    {
        var set = await ForCurrentUserAsync(ct);
        if (set.WithinLimit(limitKey, attemptedTotal)) return;

        throw Errors.PlanLimitExceeded(limitKey, set.Limit(limitKey), attemptedTotal, RequiredPlanFor(limitKey), "Plan limit reached.");
    }

    public async Task<int> ReadUsageAsync(string metric, CancellationToken ct)
    {
        await ForCurrentUserAsync(ct);
        if (_currentUserPlan!.BillingAccountId is not Guid billingAccountId) return 0;

        var periodKey = UsagePeriod.KeyFor(_currentUserPlan.CurrentPeriodStart, DateTime.UtcNow);
        var value = await _db.UsageCounters.AsNoTracking()
            .Where(c => c.BillingAccountId == billingAccountId && c.Metric == metric && c.PeriodKey == periodKey)
            .Select(c => (int?)c.Value)
            .FirstOrDefaultAsync(ct);

        return value ?? 0;
    }

    public async Task IncrementUsageAsync(string metric, CancellationToken ct)
    {
        await ForCurrentUserAsync(ct);
        // Billing disabled entirely: there is no account to attach a counter
        // to, and nothing reads it back either, so there is nothing to do.
        if (_currentUserPlan!.BillingAccountId is not Guid billingAccountId) return;

        var periodKey = UsagePeriod.KeyFor(_currentUserPlan.CurrentPeriodStart, DateTime.UtcNow);

        await ConcurrentCounters.IncrementOrCreateAsync(
            token => _db.UsageCounters
                .Where(c => c.BillingAccountId == billingAccountId && c.Metric == metric && c.PeriodKey == periodKey)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(c => c.Value, c => c.Value + 1)
                    .SetProperty(c => c.UpdatedAt, DateTime.UtcNow), token),
            async token =>
            {
                _db.UsageCounters.Add(new UsageCounter
                {
                    BillingAccountId = billingAccountId,
                    Metric = metric,
                    PeriodKey = periodKey,
                    Value = 1,
                    UpdatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync(token);
            },
            ct);
    }

    public async Task EnsureWithinLimitForUserAsync(Guid userId, string limitKey, long attemptedTotal, CancellationToken ct)
    {
        var set = await ForUserAsync(userId, ct);
        if (set.WithinLimit(limitKey, attemptedTotal)) return;

        throw Errors.PlanLimitExceeded(limitKey, set.Limit(limitKey), attemptedTotal, RequiredPlanFor(limitKey), "Plan limit reached.");
    }

    public async Task<int> ReadUsageForUserAsync(Guid userId, string metric, CancellationToken ct)
    {
        var plan = await ResolveCachedAsync(userId, ct);
        if (plan.BillingAccountId is not Guid billingAccountId) return 0;

        var periodKey = UsagePeriod.KeyFor(plan.CurrentPeriodStart, DateTime.UtcNow);
        var value = await _db.UsageCounters.AsNoTracking()
            .Where(c => c.BillingAccountId == billingAccountId && c.Metric == metric && c.PeriodKey == periodKey)
            .Select(c => (int?)c.Value)
            .FirstOrDefaultAsync(ct);

        return value ?? 0;
    }

    public async Task IncrementUsageForUserAsync(Guid userId, string metric, CancellationToken ct)
    {
        var plan = await ResolveCachedAsync(userId, ct);
        if (plan.BillingAccountId is not Guid billingAccountId) return;

        var periodKey = UsagePeriod.KeyFor(plan.CurrentPeriodStart, DateTime.UtcNow);

        await ConcurrentCounters.IncrementOrCreateAsync(
            token => _db.UsageCounters
                .Where(c => c.BillingAccountId == billingAccountId && c.Metric == metric && c.PeriodKey == periodKey)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(c => c.Value, c => c.Value + 1)
                    .SetProperty(c => c.UpdatedAt, DateTime.UtcNow), token),
            async token =>
            {
                _db.UsageCounters.Add(new UsageCounter
                {
                    BillingAccountId = billingAccountId,
                    Metric = metric,
                    PeriodKey = periodKey,
                    Value = 1,
                    UpdatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync(token);
            },
            ct);
    }

    private async Task<ResolvedPlan> ResolveCachedAsync(Guid userId, CancellationToken ct)
    {
        var cacheKey = PlanCacheKey(userId);
        if (_cache.TryGetValue(cacheKey, out ResolvedPlan? cached) && cached is not null)
            return cached;

        var resolved = await _resolver.ForUserAsync(userId, ct);
        _cache.Set(cacheKey, resolved, CacheTtl);
        return resolved;
    }

    private async Task<EntitlementSet> BuildSetAsync(ResolvedPlan resolved, CancellationToken ct)
    {
        if (!PlanCatalog.TryGet(resolved.PlanCode, out var plan))
        {
            _logger.LogWarning(
                "Unknown plan code {PlanCode}; falling back to the unlimited plan.", resolved.PlanCode);
        }

        var values = new Dictionary<string, long>(plan.Values);

        if (resolved.BillingAccountId is Guid billingAccountId)
        {
            var now = DateTime.UtcNow;
            var overrides = await _db.EntitlementOverrides.AsNoTracking()
                .Where(o => o.BillingAccountId == billingAccountId && (o.ExpiresAt == null || o.ExpiresAt > now))
                .ToListAsync(ct);

            // Overrides are the highest-priority layer: an admin can both
            // raise and lower any single key without minting a new plan code.
            foreach (var o in overrides)
                values[o.Key] = o.Value;
        }

        return new EntitlementSet
        {
            PlanCode = resolved.PlanCode,
            Source = resolved.Source,
            Status = resolved.Status,
            CurrentPeriodEnd = resolved.CurrentPeriodEnd,
            Values = values,
        };
    }

    private static string? RequiredPlanFor(string key)
    {
        if (PlanCatalog.TryGet(PlanCatalog.Pro, out var pro) && pro.Values.TryGetValue(key, out var proValue) && proValue != 0)
            return PlanCatalog.Pro;
        if (PlanCatalog.TryGet(PlanCatalog.Team, out var team) && team.Values.TryGetValue(key, out var teamValue) && teamValue != 0)
            return PlanCatalog.Team;
        return null;
    }

    internal static string PlanCacheKey(Guid userId) => $"billing:plan:{userId}";
}
