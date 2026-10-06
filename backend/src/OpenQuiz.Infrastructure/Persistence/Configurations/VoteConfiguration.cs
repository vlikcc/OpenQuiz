using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class VoteConfiguration : IEntityTypeConfiguration<Vote>
{
    public void Configure(EntityTypeBuilder<Vote> b)
    {
        b.ToTable("Votes");
        b.HasKey(x => x.Id);
        b.Property(x => x.UserName).IsRequired().HasMaxLength(128);
        b.Property(x => x.SelectedOptionIndices).IsRequired().HasMaxLength(256);
        b.Property(x => x.VoterKey).IsRequired().HasMaxLength(160);

        b.HasIndex(x => x.PollId);
        // Backstop for concurrent double submits; the service checks first so
        // the common case gets a friendly conflict rather than a constraint error.
        b.HasIndex(x => new { x.QuestionId, x.VoterKey }).IsUnique();
        b.HasIndex(x => new { x.QuestionId, x.UserName });
    }
}
