using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class PollConfiguration : IEntityTypeConfiguration<Poll>
{
    public void Configure(EntityTypeBuilder<Poll> b)
    {
        b.ToTable("Polls");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).IsRequired().HasMaxLength(256);
        b.Property(x => x.Type).HasConversion<byte>();
        b.Property(x => x.Status).HasConversion<byte>();
        b.Property(x => x.RowVersion).IsRowVersion();

        b.Property(x => x.JoinCode).HasMaxLength(6);
        b.Property(x => x.ResultsShareToken).HasMaxLength(32);

        b.HasIndex(x => x.CreatorId);
        b.HasIndex(x => x.CreatedAt);
        // Active-poll caps count a creator's Live polls, so the pair
        // is queried together whenever a plan limit is checked.
        b.HasIndex(x => new { x.CreatorId, x.Status });
        b.HasIndex(x => x.JoinCode).IsUnique().HasFilter("\"JoinCode\" IS NOT NULL");
        b.HasIndex(x => x.ResultsShareToken).IsUnique().HasFilter("\"ResultsShareToken\" IS NOT NULL");
        b.HasIndex(x => new { x.Status, x.ScheduledStartAt });

        b.HasMany(x => x.Questions)
            .WithOne(x => x.Poll)
            .HasForeignKey(x => x.PollId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
