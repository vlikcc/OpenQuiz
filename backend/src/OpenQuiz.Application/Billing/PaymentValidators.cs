using FluentValidation;

namespace OpenQuiz.Application.Billing;

public class CreateCheckoutApiValidator : AbstractValidator<CreateCheckoutApiRequest>
{
    public CreateCheckoutApiValidator()
    {
        RuleFor(x => x.PlanCode)
            .NotEmpty()
            .Must(PlanCatalog.IsPurchasable)
            .WithMessage("That plan is not available for purchase.");
        RuleFor(x => x.Interval)
            .NotEmpty()
            .Must(CheckoutIntervals.IsKnown)
            .WithMessage("Interval must be monthly or yearly.");
    }
}
