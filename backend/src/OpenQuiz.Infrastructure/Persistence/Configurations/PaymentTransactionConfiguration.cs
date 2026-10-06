using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> b)
    {
        b.ToTable("PaymentTransactions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).IsRequired().HasMaxLength(32);
        b.Property(x => x.ProviderPaymentId).HasMaxLength(128);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Currency).IsRequired().HasMaxLength(3);
        b.Property(x => x.Status).HasConversion<byte>();
        b.Property(x => x.InvoiceNumber).HasMaxLength(64);

        b.HasIndex(x => x.BillingAccountId);
        b.HasIndex(x => x.ProviderPaymentId)
            .IsUnique()
            .HasFilter("\"ProviderPaymentId\" IS NOT NULL");
    }
}
