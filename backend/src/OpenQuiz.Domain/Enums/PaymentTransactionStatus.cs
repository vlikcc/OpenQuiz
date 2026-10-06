namespace OpenQuiz.Domain.Enums;

public enum PaymentTransactionStatus : byte
{
    Succeeded = 1,
    Failed = 2,
    Refunded = 3
}
