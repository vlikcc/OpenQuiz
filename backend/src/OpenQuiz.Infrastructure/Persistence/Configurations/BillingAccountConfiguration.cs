using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class BillingAccountConfiguration : IEntityTypeConfiguration<BillingAccount>
{
    public void Configure(EntityTypeBuilder<BillingAccount> b)
    {
        b.ToTable("BillingAccounts");
        b.HasKey(x => x.Id);
        b.Property(x => x.PlanCode).IsRequired().HasMaxLength(64);
        b.Property(x => x.Status).HasConversion<byte>();
        b.Property(x => x.Source).HasConversion<byte>();
        b.Property(x => x.ProviderKey).HasMaxLength(32);
        b.Property(x => x.ProviderCustomerId).HasMaxLength(128);
        b.Property(x => x.ProviderSubscriptionId).HasMaxLength(128);
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => x.OwnerUserId).IsUnique();
        b.HasIndex(x => x.OrganizationId);
        b.HasIndex(x => x.ProviderSubscriptionId)
            .IsUnique()
            .HasFilter("\"ProviderSubscriptionId\" IS NOT NULL");

        b.HasOne(x => x.Owner)
            .WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasMany(x => x.Overrides)
            .WithOne(x => x.BillingAccount)
            .HasForeignKey(x => x.BillingAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.UsageCounters)
            .WithOne(x => x.BillingAccount)
            .HasForeignKey(x => x.BillingAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.PaymentTransactions)
            .WithOne(x => x.BillingAccount)
            .HasForeignKey(x => x.BillingAccountId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
