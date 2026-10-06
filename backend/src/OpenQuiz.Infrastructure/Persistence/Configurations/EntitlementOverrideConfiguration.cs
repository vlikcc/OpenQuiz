using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class EntitlementOverrideConfiguration : IEntityTypeConfiguration<EntitlementOverride>
{
    public void Configure(EntityTypeBuilder<EntitlementOverride> b)
    {
        b.ToTable("EntitlementOverrides");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).IsRequired().HasMaxLength(64);
        b.Property(x => x.Reason).HasMaxLength(256);

        b.HasIndex(x => new { x.BillingAccountId, x.Key }).IsUnique();
    }
}
