using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class ScoreConfiguration : IEntityTypeConfiguration<Score>
{
    public void Configure(EntityTypeBuilder<Score> b)
    {
        b.ToTable("Scores");
        b.HasKey(x => x.Id);
        b.Property(x => x.UserName).IsRequired().HasMaxLength(128);

        b.HasIndex(x => new { x.PollId, x.UserName })
            .IsUnique()
            .HasFilter("\"PollId\" IS NOT NULL");
        b.HasIndex(x => new { x.PollId, x.Points });
    }
}

public class ReactionConfiguration : IEntityTypeConfiguration<Reaction>
{
    public void Configure(EntityTypeBuilder<Reaction> b)
    {
        b.ToTable("Reactions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Emoji).IsRequired().HasMaxLength(16);
        b.Property(x => x.Sender).HasMaxLength(128);

        b.HasIndex(x => new { x.PollId, x.CreatedAt });
    }
}
