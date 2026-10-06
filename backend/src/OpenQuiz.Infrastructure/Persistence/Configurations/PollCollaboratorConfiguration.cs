using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class PollCollaboratorConfiguration : IEntityTypeConfiguration<PollCollaborator>
{
    public void Configure(EntityTypeBuilder<PollCollaborator> b)
    {
        b.ToTable("PollCollaborators");
        b.HasKey(x => x.Id);

        b.HasIndex(x => new { x.PollId, x.UserId }).IsUnique();
        b.HasIndex(x => x.UserId);

        b.HasOne(x => x.Poll)
            .WithMany(p => p.Collaborators)
            .HasForeignKey(x => x.PollId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
