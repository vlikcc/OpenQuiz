namespace OpenQuiz.Domain.Enums;

public enum SubscriptionStatus : byte
{
    Active = 1,
    Trialing = 2,
    PastDue = 3,
    Canceled = 4,
    Expired = 5
}
