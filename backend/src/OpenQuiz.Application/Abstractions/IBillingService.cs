using OpenQuiz.Application.Billing;

namespace OpenQuiz.Application.Abstractions;

public interface IBillingService
{
    Task<BillingMeDto> GetMeAsync(CancellationToken ct);
    Task<List<PlanSummaryDto>> ListPlansAsync(CancellationToken ct);

    /// <summary>
    /// Admin-only: moves a user onto a plan by hand. This is what makes the
    /// entitlement engine revenue-capable before any payment provider is
    /// wired up — a customer wires money, an admin flips their plan here.
    /// </summary>
    Task SetAccountPlanAsync(Guid userId, string planCode, CancellationToken ct);

    Task<CheckoutSessionDto> CreateCheckoutAsync(CreateCheckoutApiRequest req, CancellationToken ct);
    Task CancelMineAsync(CancelSubscriptionRequest req, CancellationToken ct);
}

