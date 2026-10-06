using Microsoft.Extensions.Options;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Billing;
using OpenQuiz.Infrastructure.Options;

namespace OpenQuiz.Infrastructure.Payments;

public class PaymentProviderRegistry : IPaymentProviderRegistry
{
    private readonly IReadOnlyDictionary<string, IPaymentProvider> _byKey;
    private readonly BillingOptions _options;

    public PaymentProviderRegistry(IEnumerable<IPaymentProvider> providers, IOptions<BillingOptions> options)
    {
        _options = options.Value;
        _byKey = providers.ToDictionary(p => p.Key, p => p, StringComparer.OrdinalIgnoreCase);
    }

    public IPaymentProvider Current =>
        Find(_options.Provider)
        ?? throw new InvalidOperationException($"No payment provider is registered for '{_options.Provider}'.");

    public IPaymentProvider? Find(string key) =>
        string.IsNullOrWhiteSpace(key) ? null : _byKey.GetValueOrDefault(key);
}
