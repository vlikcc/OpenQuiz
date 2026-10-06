using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> b)
    {
        b.ToTable("Questions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Text).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(1024);
        b.Property(x => x.QuestionType).HasConversion<byte>();
        b.Property(x => x.CorrectAnswer);
        b.Property(x => x.WordCloudConfig);

        b.HasIndex(x => new { x.PollId, x.OrderIndex }).IsUnique();

        b.HasMany(x => x.Options)
            .WithOne(x => x.Question)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
