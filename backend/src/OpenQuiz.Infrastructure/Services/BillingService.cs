using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Application.Common;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class BillingService : IBillingService
{
    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IEntitlementService _entitlements;
    private readonly IPlanResolver _resolver;
    private readonly IPaymentProviderRegistry _providers;
    private readonly IMemoryCache _cache;
    private readonly BillingOptions _options;
    private readonly AppOptions _app;
    private readonly IValidator<CreateCheckoutApiRequest> _checkoutValidator;

    public BillingService(
        OpenQuizDbContext db,
        ICurrentUser current,
        IEntitlementService entitlements,
        IPlanResolver resolver,
        IPaymentProviderRegistry providers,
        IMemoryCache cache,
        IOptions<BillingOptions> options,
        IOptions<AppOptions> app,
        IValidator<CreateCheckoutApiRequest> checkoutValidator)
    {
        _db = db; _current = current; _entitlements = entitlements; _resolver = resolver;
        _providers = providers; _cache = cache;
        _options = options.Value; _app = app.Value;
        _checkoutValidator = checkoutValidator;
    }

    public async Task<BillingMeDto> GetMeAsync(CancellationToken ct)
    {
        if (_current.UserId is not Guid uid) throw Errors.Unauthorized();

        var set = await _entitlements.ForCurrentUserAsync(ct);

        var activePolls = await _db.Polls.AsNoTracking()
            .CountAsync(p => p.CreatorId == uid && p.Status == Domain.Enums.PollStatus.Live, ct);
        var sessionsThisMonth = await _entitlements.ReadUsageAsync("sessions", ct);

        var usage = new Dictionary<string, long>
        {
            [EntitlementKeys.LimitActivePolls] = activePolls,
            [EntitlementKeys.LimitSessionsPerMonth] = sessionsThisMonth,
        };

        return new BillingMeDto(
            set.PlanCode,
            set.Source.ToString(),
            set.Status.ToString(),
            set.CurrentPeriodEnd,
            set.Values,
            usage);
    }

    public Task<List<PlanSummaryDto>> ListPlansAsync(CancellationToken ct)
    {
        var result = PlanCatalog.All
            .Select(plan =>
            {
                _options.Prices.TryGetValue(plan.Code, out var pricing);
                var dto = pricing is null
                    ? null
                    : new PlanPricingDto(pricing.Monthly, pricing.Yearly, _options.Currency);
                return new PlanSummaryDto(plan.Code, plan.Values, dto);
            })
            .ToList();

        return Task.FromResult(result);
    }

    public async Task SetAccountPlanAsync(Guid userId, string planCode, CancellationToken ct)
    {
        EnsureAdmin();

        if (!PlanCatalog.TryGet(planCode, out _))
            throw Errors.Validation($"Unknown plan code '{planCode}'.");

        var account = await _db.BillingAccounts.FirstOrDefaultAsync(a => a.OwnerUserId == userId, ct);
        if (account is null)
        {
            account = new BillingAccount
            {
                OwnerUserId = userId,
                PlanCode = planCode,
                Source = PlanSource.Manual,
                Status = SubscriptionStatus.Active,
                CreatedAt = DateTime.UtcNow,
            };
            _db.BillingAccounts.Add(account);
        }
        else
        {
            account.PlanCode = planCode;
            account.Source = PlanSource.Manual;
            account.Status = SubscriptionStatus.Active;
            account.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        await BillingCache.EvictForUserAsync(_db, _cache, userId, ct);
    }

    public async Task<CheckoutSessionDto> CreateCheckoutAsync(CreateCheckoutApiRequest req, CancellationToken ct)
    {
        if (_current.UserId is not Guid uid) throw Errors.Unauthorized();
        if (!_options.Enabled) throw Errors.Validation("Billing is not enabled on this instance.");

        await _checkoutValidator.ValidateAndThrowAsync(req, ct);

        var provider = _providers.Current;
        if (!provider.IsConfigured)
            throw Errors.ServiceUnavailable("The payment provider is not configured.");

        var planCode = CanonicalPurchasable(req.PlanCode);
        var resolved = await _resolver.ForUserAsync(uid, ct);
        var accountId = resolved.BillingAccountId
            ?? (await _db.BillingAccounts.AsNoTracking()
                .Where(a => a.OwnerUserId == uid)
                .Select(a => (Guid?)a.Id)
                .FirstOrDefaultAsync(ct))
            ?? throw Errors.Validation("Billing account could not be created.");

        var account = await _db.BillingAccounts.FirstAsync(a => a.Id == accountId, ct);
        var origin = (_app.PublicUrl ?? "").TrimEnd('/');
        var returnUrl = string.IsNullOrWhiteSpace(_options.CheckoutReturnUrl)
            ? origin
            : _options.CheckoutReturnUrl;

        var session = await provider.CreateCheckoutAsync(new CheckoutRequest(
            uid,
            account.Id,
            planCode,
            req.Interval.ToLowerInvariant(),
            returnUrl,
            returnUrl,
            PriceIdFor(planCode, req.Interval),
            account.ProviderCustomerId), ct);

        return new CheckoutSessionDto(session.Url, session.ProviderSessionId);
    }

    public async Task CancelMineAsync(CancelSubscriptionRequest req, CancellationToken ct)
    {
        if (_current.UserId is not Guid uid) throw Errors.Unauthorized();
        if (!_options.Enabled) throw Errors.Validation("Billing is not enabled on this instance.");

        var account = await _db.BillingAccounts.FirstOrDefaultAsync(a => a.OwnerUserId == uid, ct)
                      ?? throw Errors.NotFound("BillingAccount");

        if (!string.IsNullOrWhiteSpace(account.ProviderSubscriptionId))
        {
            var provider = _providers.Find(account.ProviderKey ?? _options.Provider);
            if (provider is { IsConfigured: true })
                await provider.CancelAsync(account.ProviderSubscriptionId, req.AtPeriodEnd, ct);
        }

        account.CancelAtPeriodEnd = true;
        if (!req.AtPeriodEnd)
        {
            account.Status = SubscriptionStatus.Canceled;
            account.PlanCode = string.IsNullOrWhiteSpace(_options.DefaultPlanCode)
                ? PlanCatalog.Free
                : _options.DefaultPlanCode;
        }

        account.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BillingCache.EvictForUserAsync(_db, _cache, uid, ct);
    }

    private string? PriceIdFor(string planCode, string interval)
    {
        if (!_options.Prices.TryGetValue(planCode, out var pricing)
            && !_options.Prices.TryGetValue(planCode.ToLowerInvariant(), out pricing))
            return null;

        var yearly = interval.Equals(CheckoutIntervals.Yearly, StringComparison.OrdinalIgnoreCase);
        return yearly
            ? pricing.ProviderPriceIdYearly ?? pricing.ProviderPriceId
            : pricing.ProviderPriceId;
    }

    private static string CanonicalPurchasable(string planCode) =>
        planCode.Equals(PlanCatalog.Team, StringComparison.OrdinalIgnoreCase)
            ? PlanCatalog.Team
            : PlanCatalog.Pro;

    private void EnsureAdmin()
    {
        if (!_current.IsAuthenticated) throw Errors.Unauthorized();
        if (!_current.IsAdmin) throw Errors.Forbidden();
    }
}
