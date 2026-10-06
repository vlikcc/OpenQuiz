using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class OpenAnswerConfiguration : IEntityTypeConfiguration<OpenAnswer>
{
    public void Configure(EntityTypeBuilder<OpenAnswer> b)
    {
        b.ToTable("OpenAnswers");
        b.HasKey(x => x.Id);
        b.Property(x => x.UserName).IsRequired().HasMaxLength(128);
        b.Property(x => x.AnswerText).IsRequired();

        b.HasIndex(x => x.PollId);
        b.HasIndex(x => x.QuestionId);
    }
}
