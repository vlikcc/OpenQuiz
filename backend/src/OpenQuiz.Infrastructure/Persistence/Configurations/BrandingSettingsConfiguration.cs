using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class BrandingSettingsConfiguration : IEntityTypeConfiguration<BrandingSettings>
{
    public void Configure(EntityTypeBuilder<BrandingSettings> b)
    {
        b.ToTable("BrandingSettings");
        b.HasKey(x => x.Id);
        b.Property(x => x.LogoUrl).HasMaxLength(2048);
        b.Property(x => x.PrimaryColor).HasMaxLength(7);
        b.Property(x => x.AccentColor).HasMaxLength(7);
        b.Property(x => x.JoinMessage).HasMaxLength(280);

        b.HasIndex(x => x.OwnerUserId).IsUnique();

        b.HasOne(x => x.Owner)
            .WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
