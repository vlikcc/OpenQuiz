using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class OptionConfiguration : IEntityTypeConfiguration<Option>
{
    public void Configure(EntityTypeBuilder<Option> b)
    {
        b.ToTable("Options");
        b.HasKey(x => x.Id);
        b.Property(x => x.Text).IsRequired().HasMaxLength(1024);
        b.HasIndex(x => new { x.QuestionId, x.OrderIndex }).IsUnique();
    }
}
