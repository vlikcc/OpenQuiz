using OpenQuiz.Domain.Enums;

namespace OpenQuiz.Domain.Entities;

public class PaymentTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BillingAccountId { get; set; }
    public BillingAccount BillingAccount { get; set; } = null!;

    public string Provider { get; set; } = string.Empty;
    public string? ProviderPaymentId { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public PaymentTransactionStatus Status { get; set; } = PaymentTransactionStatus.Succeeded;
    public string? InvoiceNumber { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
