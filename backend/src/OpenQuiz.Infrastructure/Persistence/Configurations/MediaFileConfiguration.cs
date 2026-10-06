using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class MediaFileConfiguration : IEntityTypeConfiguration<MediaFile>
{
    public void Configure(EntityTypeBuilder<MediaFile> b)
    {
        b.ToTable("MediaFiles");
        b.HasKey(x => x.Id);
        b.Property(x => x.ContentType).IsRequired().HasMaxLength(64);
        b.Property(x => x.Extension).IsRequired().HasMaxLength(8);
        b.Property(x => x.OriginalFileName).IsRequired().HasMaxLength(256);
        b.HasIndex(x => x.OwnerUserId);

        b.HasOne(x => x.Owner)
            .WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
