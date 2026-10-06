using OpenQuiz.Application.Branding;

namespace OpenQuiz.Application.Abstractions;

public interface IBrandingService
{
    /// <summary>The signed-in user's saved branding, or empty defaults.</summary>
    Task<BrandingDto> GetMineAsync(CancellationToken ct);

    /// <summary>Gated on <c>branding.custom</c>. Upserts the signed-in user's row.</summary>
    Task<BrandingDto> UpdateMineAsync(UpdateBrandingRequest req, CancellationToken ct);

    /// <summary>
    /// Anonymous join-screen read. Returns <see cref="BrandingDto.Empty"/> when
    /// the poll's creator does not currently have the branding feature, so a
    /// cancelled plan cannot keep white-labelling the product.
    /// </summary>
    Task<BrandingDto> GetForPollAsync(Guid pollId, CancellationToken ct);
}
