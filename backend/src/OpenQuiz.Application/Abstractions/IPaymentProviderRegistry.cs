namespace OpenQuiz.Application.Abstractions;

public interface IPaymentProviderRegistry
{
    /// <summary>The provider named in <c>Billing:Provider</c>. Throws if unknown.</summary>
    IPaymentProvider Current { get; }

    IPaymentProvider? Find(string key);
}
