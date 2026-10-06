using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

/// <summary>
/// Resolves a user's plan. Cloud and self-hosted go through the exact same
/// method — they differ only in which branch below fires. A future
/// self-hosted license check (Phase 4) slots in ahead of everything here,
/// since a license is instance-wide and outranks any per-account state.
/// </summary>
public class PlanResolver : IPlanResolver
{
    private readonly OpenQuizDbContext _db;
    private readonly BillingOptions _options;

    public PlanResolver(OpenQuizDbContext db, IOptions<BillingOptions> options)
    {
        _db = db;
        _options = options.Value;
    }

    public async Task<ResolvedPlan> ForUserAsync(Guid userId, CancellationToken ct)
    {
        if (!_options.Enabled)
        {
            // Billing is off entirely — the self-hosted default. No account
            // row is created, so an instance that never opts in never grows
            // a BillingAccounts table.
            return new ResolvedPlan(null, _options.DefaultPlanCode, PlanSource.Default, SubscriptionStatus.Active, null, null);
        }

        var account = await _db.BillingAccounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.OwnerUserId == userId, ct);

        if (account is not null)
        {
            return new ResolvedPlan(
                account.Id, account.PlanCode, account.Source, account.Status,
                account.CurrentPeriodStart, account.CurrentPeriodEnd);
        }

        var (planCode, source) = await ResolveNewAccountPlanAsync(userId, ct);
        var created = new BillingAccount
        {
            OwnerUserId = userId,
            PlanCode = planCode,
            Source = source,
            Status = SubscriptionStatus.Active,
            CreatedAt = DateTime.UtcNow,
        };

        _db.BillingAccounts.Add(created);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // A concurrent request for the same user created the row first;
            // the unique index on OwnerUserId rejected ours. Read theirs.
            var existing = await _db.BillingAccounts.AsNoTracking()
                .FirstAsync(a => a.OwnerUserId == userId, ct);
            return new ResolvedPlan(existing.Id, existing.PlanCode, existing.Source, existing.Status,
                existing.CurrentPeriodStart, existing.CurrentPeriodEnd);
        }

        return new ResolvedPlan(created.Id, created.PlanCode, created.Source, created.Status,
            created.CurrentPeriodStart, created.CurrentPeriodEnd);
    }

    private async Task<(string PlanCode, PlanSource Source)> ResolveNewAccountPlanAsync(Guid userId, CancellationToken ct)
    {
        if (_options.LegacyCutoffUtc is { } cutoff && !string.IsNullOrWhiteSpace(_options.LegacyPlanCode))
        {
            var createdAt = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => (DateTime?)u.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (createdAt is { } created && created < cutoff)
                return (_options.LegacyPlanCode, PlanSource.Legacy);
        }

        return (_options.DefaultPlanCode, PlanSource.Default);
    }
}
