using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class UsageCounterConfiguration : IEntityTypeConfiguration<UsageCounter>
{
    public void Configure(EntityTypeBuilder<UsageCounter> b)
    {
        b.ToTable("UsageCounters");
        b.HasKey(x => x.Id);
        b.Property(x => x.Metric).IsRequired().HasMaxLength(32);
        b.Property(x => x.PeriodKey).IsRequired().HasMaxLength(16);

        b.HasIndex(x => new { x.BillingAccountId, x.Metric, x.PeriodKey }).IsUnique();
    }
}
