using FluentValidation;

namespace OpenQuiz.Application.Auth;

public class RegisterValidator : AbstractValidator<RegisterRequest>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
        RuleFor(x => x.DisplayName).MaximumLength(128);
    }
}

public class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class GoogleLoginValidator : AbstractValidator<GoogleLoginRequest>
{
    public GoogleLoginValidator() => RuleFor(x => x.IdToken).NotEmpty();
}

public class RefreshValidator : AbstractValidator<RefreshRequest>
{
    public RefreshValidator() => RuleFor(x => x.RefreshToken).NotEmpty();
}

public class PasswordResetRequestValidator : AbstractValidator<PasswordResetRequest>
{
    public PasswordResetRequestValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public class PasswordResetConfirmValidator : AbstractValidator<PasswordResetConfirm>
{
    public PasswordResetConfirmValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).MaximumLength(128);
    }
}
