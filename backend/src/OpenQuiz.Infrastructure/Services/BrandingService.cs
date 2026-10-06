using FluentValidation;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Application.Branding;
using OpenQuiz.Application.Common;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class BrandingService : IBrandingService
{
    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;
    private readonly IEntitlementService _entitlements;
    private readonly IValidator<UpdateBrandingRequest> _validator;

    public BrandingService(
        OpenQuizDbContext db,
        ICurrentUser user,
        IEntitlementService entitlements,
        IValidator<UpdateBrandingRequest> validator)
    {
        _db = db; _user = user; _entitlements = entitlements; _validator = validator;
    }

    public async Task<BrandingDto> GetMineAsync(CancellationToken ct)
    {
        if (_user.UserId is not Guid uid) throw Errors.Unauthorized();
        var row = await _db.BrandingSettings.AsNoTracking()
            .FirstOrDefaultAsync(b => b.OwnerUserId == uid, ct);
        return Map(row);
    }

    public async Task<BrandingDto> UpdateMineAsync(UpdateBrandingRequest req, CancellationToken ct)
    {
        if (_user.UserId is not Guid uid) throw Errors.Unauthorized();
        await _validator.ValidateAndThrowAsync(req, ct);
        await _entitlements.EnsureFeatureAsync(EntitlementKeys.BrandingCustom, ct);

        var row = await _db.BrandingSettings.FirstOrDefaultAsync(b => b.OwnerUserId == uid, ct);
        if (row is null)
        {
            row = new BrandingSettings { OwnerUserId = uid, CreatedAt = DateTime.UtcNow };
            _db.BrandingSettings.Add(row);
        }

        row.LogoUrl = BlankToNull(req.LogoUrl);
        row.PrimaryColor = BlankToNull(req.PrimaryColor);
        row.AccentColor = BlankToNull(req.AccentColor);
        row.HideOpenQuizBranding = req.HideOpenQuizBranding;
        row.JoinMessage = BlankToNull(req.JoinMessage);
        row.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Map(row);
    }

    public async Task<BrandingDto> GetForPollAsync(Guid pollId, CancellationToken ct)
    {
        var creatorId = await _db.Polls.AsNoTracking()
            .Where(p => p.Id == pollId)
            .Select(p => (Guid?)p.CreatorId)
            .FirstOrDefaultAsync(ct)
            ?? throw Errors.NotFound("Poll");

        var set = await _entitlements.ForUserAsync(creatorId, ct);
        if (!set.Has(EntitlementKeys.BrandingCustom))
            return BrandingDto.Empty;

        var row = await _db.BrandingSettings.AsNoTracking()
            .FirstOrDefaultAsync(b => b.OwnerUserId == creatorId, ct);
        return Map(row);
    }

    private static BrandingDto Map(BrandingSettings? row) =>
        row is null
            ? BrandingDto.Empty
            : new BrandingDto(row.LogoUrl, row.PrimaryColor, row.AccentColor, row.HideOpenQuizBranding, row.JoinMessage);

    private static string? BlankToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
