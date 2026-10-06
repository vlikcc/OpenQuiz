using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("Users");
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).IsRequired().HasMaxLength(256);
        b.Property(x => x.DisplayName).HasMaxLength(128);
        b.Property(x => x.PasswordHash).HasMaxLength(512);
        b.Property(x => x.GoogleSub).HasMaxLength(128);

        b.HasIndex(x => x.Email).IsUnique();
        b.HasIndex(x => x.GoogleSub).IsUnique().HasFilter("\"GoogleSub\" IS NOT NULL");

        b.HasMany(x => x.RefreshTokens)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.CreatedPolls)
            .WithOne(x => x.Creator)
            .HasForeignKey(x => x.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
