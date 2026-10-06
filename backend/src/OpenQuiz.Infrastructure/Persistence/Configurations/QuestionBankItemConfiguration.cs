using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class QuestionBankItemConfiguration : IEntityTypeConfiguration<QuestionBankItem>
{
    public void Configure(EntityTypeBuilder<QuestionBankItem> b)
    {
        b.ToTable("QuestionBankItems");
        b.HasKey(x => x.Id);
        b.Property(x => x.Text).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(1024);
        b.Property(x => x.QuestionType).HasConversion<byte>();
        b.HasIndex(x => x.OwnerUserId);

        b.HasOne(x => x.Owner)
            .WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.Options)
            .WithOne(x => x.Item)
            .HasForeignKey(x => x.ItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
