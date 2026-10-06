using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class WordCloudSubmissionConfiguration : IEntityTypeConfiguration<WordCloudSubmission>
{
    public void Configure(EntityTypeBuilder<WordCloudSubmission> b)
    {
        b.ToTable("WordCloudSubmissions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Term).IsRequired().HasMaxLength(64);
        b.Property(x => x.OriginalTerm).IsRequired().HasMaxLength(64);
        b.Property(x => x.UserName).IsRequired().HasMaxLength(128);

        b.HasIndex(x => new { x.QuestionId, x.Term });
        b.HasIndex(x => x.PollId);
    }
}

public class WordCloudAggregateConfiguration : IEntityTypeConfiguration<WordCloudAggregate>
{
    public void Configure(EntityTypeBuilder<WordCloudAggregate> b)
    {
        b.ToTable("WordCloudAggregates");
        b.HasKey(x => x.Id);
        b.Property(x => x.Term).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.QuestionId, x.Term }).IsUnique();
        b.HasIndex(x => new { x.QuestionId, x.Count });
    }
}
