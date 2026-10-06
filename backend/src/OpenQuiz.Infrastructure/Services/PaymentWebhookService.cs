using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class PaymentWebhookService : IPaymentWebhookService
{
    private readonly OpenQuizDbContext _db;
    private readonly IPaymentProviderRegistry _providers;
    private readonly IMemoryCache _cache;
    private readonly BillingOptions _options;
    private readonly ILogger<PaymentWebhookService> _logger;

    public PaymentWebhookService(
        OpenQuizDbContext db,
        IPaymentProviderRegistry providers,
        IMemoryCache cache,
        IOptions<BillingOptions> options,
        ILogger<PaymentWebhookService> logger)
    {
        _db = db; _providers = providers; _cache = cache;
        _options = options.Value; _logger = logger;
    }

    public async Task<WebhookHandleResult> HandleAsync(
        string providerKey,
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken ct)
    {
        var provider = _providers.Find(providerKey);
        if (provider is null) return WebhookHandleResult.UnknownProvider;

        var parsed = await provider.ParseWebhookAsync(rawBody, headers, ct);
        if (parsed is null || string.IsNullOrWhiteSpace(parsed.EventId))
            return WebhookHandleResult.InvalidSignature;

        var row = await ClaimEventAsync(provider.Key, parsed.EventId, ct);
        if (row is null) return WebhookHandleResult.Ok;

        await ApplyAsync(provider.Key, parsed, ct);

        row.ProcessedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return WebhookHandleResult.Ok;
    }

    /// <summary>
    /// Inserts the idempotency row. Returns it when this delivery should run
    /// the side effects; <c>null</c> when a previous delivery already finished.
    /// </summary>
    private async Task<ProcessedWebhookEvent?> ClaimEventAsync(string provider, string eventId, CancellationToken ct)
    {
        var existing = await _db.ProcessedWebhookEvents
            .FirstOrDefaultAsync(e => e.Provider == provider && e.EventId == eventId, ct);
        if (existing is not null)
            return existing.ProcessedAt is null ? existing : null;

        var created = new ProcessedWebhookEvent
        {
            Provider = provider,
            EventId = eventId,
            ReceivedAt = DateTime.UtcNow,
        };
        _db.ProcessedWebhookEvents.Add(created);
        try
        {
            await _db.SaveChangesAsync(ct);
            return created;
        }
        catch (DbUpdateException ex) when (ConcurrentCounters.IsUniqueViolation(ex))
        {
            _db.Entry(created).State = EntityState.Detached;
            var winner = await _db.ProcessedWebhookEvents
                .FirstAsync(e => e.Provider == provider && e.EventId == eventId, ct);
            return winner.ProcessedAt is null ? winner : null;
        }
    }

    private async Task ApplyAsync(string providerKey, WebhookEvent ev, CancellationToken ct)
    {
        switch (ev.Type)
        {
            case WebhookEventTypes.SubscriptionCreated:
            case WebhookEventTypes.SubscriptionUpdated:
                await ApplySubscriptionAsync(providerKey, ev, canceled: false, ct);
                break;
            case WebhookEventTypes.SubscriptionCanceled:
                await ApplySubscriptionAsync(providerKey, ev, canceled: true, ct);
                break;
            case WebhookEventTypes.InvoicePaid:
                await RecordPaymentAsync(providerKey, ev, PaymentTransactionStatus.Succeeded, ct);
                await ApplySubscriptionAsync(providerKey, ev, canceled: false, ct);
                break;
            case WebhookEventTypes.InvoiceFailed:
                await RecordPaymentAsync(providerKey, ev, PaymentTransactionStatus.Failed, ct);
                await MarkPastDueAsync(providerKey, ev, ct);
                break;
            default:
                // Recognised payload, unhandled type: 200 so the provider
                // stops retrying. We still stamped the event id above.
                _logger.LogInformation("Ignoring unhandled {Provider} webhook type {Type}", providerKey, ev.Type);
                break;
        }
    }

    private async Task ApplySubscriptionAsync(string providerKey, WebhookEvent ev, bool canceled, CancellationToken ct)
    {
        var account = await FindAccountAsync(providerKey, ev, ct);
        if (account is null) return;

        if (canceled)
        {
            account.Status = ev.CancelAtPeriodEnd ? account.Status : SubscriptionStatus.Canceled;
            account.CancelAtPeriodEnd = true;
            if (!ev.CancelAtPeriodEnd)
                account.PlanCode = string.IsNullOrWhiteSpace(_options.DefaultPlanCode) ? PlanCatalog.Free : _options.DefaultPlanCode;
        }
        else
        {
            var planCode = PlanCodeForPriceId(ev.ProviderPriceId);
            if (planCode is not null)
                account.PlanCode = planCode;
            account.Status = SubscriptionStatus.Active;
            account.CancelAtPeriodEnd = ev.CancelAtPeriodEnd;
        }

        account.Source = PlanSource.Provider;
        account.ProviderKey = providerKey;
        if (!string.IsNullOrWhiteSpace(ev.ProviderCustomerId))
            account.ProviderCustomerId = ev.ProviderCustomerId;
        if (!string.IsNullOrWhiteSpace(ev.ProviderSubscriptionId))
            account.ProviderSubscriptionId = ev.ProviderSubscriptionId;
        account.CurrentPeriodStart = ev.CurrentPeriodStart ?? account.CurrentPeriodStart;
        account.CurrentPeriodEnd = ev.CurrentPeriodEnd ?? account.CurrentPeriodEnd;
        account.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await BillingCache.EvictForUserAsync(_db, _cache, account.OwnerUserId, ct);
    }

    private async Task MarkPastDueAsync(string providerKey, WebhookEvent ev, CancellationToken ct)
    {
        var account = await FindAccountAsync(providerKey, ev, ct);
        if (account is null) return;

        account.Status = SubscriptionStatus.PastDue;
        account.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BillingCache.EvictForUserAsync(_db, _cache, account.OwnerUserId, ct);
    }

    private async Task RecordPaymentAsync(
        string providerKey, WebhookEvent ev, PaymentTransactionStatus status, CancellationToken ct)
    {
        var account = await FindAccountAsync(providerKey, ev, ct);
        if (account is null) return;

        if (!string.IsNullOrWhiteSpace(ev.ProviderPaymentId))
        {
            var exists = await _db.PaymentTransactions.AsNoTracking()
                .AnyAsync(t => t.ProviderPaymentId == ev.ProviderPaymentId, ct);
            if (exists) return;
        }

        _db.PaymentTransactions.Add(new PaymentTransaction
        {
            BillingAccountId = account.Id,
            Provider = providerKey,
            ProviderPaymentId = string.IsNullOrWhiteSpace(ev.ProviderPaymentId) ? null : ev.ProviderPaymentId,
            Amount = ev.Amount ?? 0,
            Currency = string.IsNullOrWhiteSpace(ev.Currency) ? _options.Currency : ev.Currency,
            Status = status,
            CreatedAt = DateTime.UtcNow,
        });

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ConcurrentCounters.IsUniqueViolation(ex))
        {
            // A concurrent retry recorded the same ProviderPaymentId first.
        }
    }

    private async Task<BillingAccount?> FindAccountAsync(string providerKey, WebhookEvent ev, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(ev.ProviderSubscriptionId))
        {
            var bySub = await _db.BillingAccounts
                .FirstOrDefaultAsync(a => a.ProviderSubscriptionId == ev.ProviderSubscriptionId, ct);
            if (bySub is not null) return bySub;
        }

        if (!string.IsNullOrWhiteSpace(ev.ProviderCustomerId))
        {
            var byCustomer = await _db.BillingAccounts
                .FirstOrDefaultAsync(a => a.ProviderKey == providerKey && a.ProviderCustomerId == ev.ProviderCustomerId, ct);
            if (byCustomer is not null) return byCustomer;
        }

        if (Guid.TryParse(ev.ClientReferenceId, out var userId))
        {
            var byOwner = await _db.BillingAccounts.FirstOrDefaultAsync(a => a.OwnerUserId == userId, ct);
            if (byOwner is not null) return byOwner;

            var created = new BillingAccount
            {
                OwnerUserId = userId,
                PlanCode = _options.DefaultPlanCode,
                Source = PlanSource.Provider,
                Status = SubscriptionStatus.Active,
                ProviderKey = providerKey,
                CreatedAt = DateTime.UtcNow,
            };
            _db.BillingAccounts.Add(created);
            try
            {
                await _db.SaveChangesAsync(ct);
                return created;
            }
            catch (DbUpdateException)
            {
                _db.Entry(created).State = EntityState.Detached;
                return await _db.BillingAccounts.FirstOrDefaultAsync(a => a.OwnerUserId == userId, ct);
            }
        }

        _logger.LogWarning(
            "Webhook {EventId} from {Provider} matched no billing account",
            ev.EventId, providerKey);
        return null;
    }

    /// <summary>
    /// Plan code comes from our price-id map, never from a field the payload
    /// named "plan". A valid signature on a price we do not sell is a no-op.
    /// </summary>
    private string? PlanCodeForPriceId(string? priceId)
    {
        if (string.IsNullOrWhiteSpace(priceId)) return null;

        foreach (var (code, pricing) in _options.Prices)
        {
            if (string.Equals(pricing.ProviderPriceId, priceId, StringComparison.Ordinal)
                || string.Equals(pricing.ProviderPriceIdYearly, priceId, StringComparison.Ordinal))
                return code;
        }

        return null;
    }
}
