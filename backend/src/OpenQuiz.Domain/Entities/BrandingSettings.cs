namespace OpenQuiz.Domain.Entities;

/// <summary>
/// Per-user white-label settings for the voter join path. Keyed on
/// <see cref="OwnerUserId"/> rather than a billing account on purpose:
/// self-hosted installs run with billing off and never grow a
/// <c>BillingAccounts</c> row (see <c>PlanResolver</c>), but the unlimited
/// default still includes <c>branding.custom</c>. The feature gate lives in
/// <c>IEntitlementService</c>, not in this foreign key.
/// </summary>
public class BrandingSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OwnerUserId { get; set; }
    public User Owner { get; set; } = null!;

    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string? AccentColor { get; set; }
    public bool HideOpenQuizBranding { get; set; }
    public string? JoinMessage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
