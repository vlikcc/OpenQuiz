using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class QuestionBankOptionConfiguration : IEntityTypeConfiguration<QuestionBankOption>
{
    public void Configure(EntityTypeBuilder<QuestionBankOption> b)
    {
        b.ToTable("QuestionBankOptions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Text).IsRequired().HasMaxLength(1024);
        b.HasIndex(x => new { x.ItemId, x.OrderIndex }).IsUnique();
    }
}
