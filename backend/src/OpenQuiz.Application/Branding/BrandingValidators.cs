using FluentValidation;

namespace OpenQuiz.Application.Branding;

public class UpdateBrandingValidator : AbstractValidator<UpdateBrandingRequest>
{
    public UpdateBrandingValidator()
    {
        RuleFor(x => x.LogoUrl)
            .MaximumLength(2048)
            .Must(BeHttpUrl)
            .When(x => !string.IsNullOrWhiteSpace(x.LogoUrl))
            .WithMessage("LogoUrl must be an http(s) URL.");

        RuleFor(x => x.PrimaryColor)
            .Must(BeHexColor)
            .When(x => !string.IsNullOrWhiteSpace(x.PrimaryColor))
            .WithMessage("PrimaryColor must be a #RRGGBB hex color.");

        RuleFor(x => x.AccentColor)
            .Must(BeHexColor)
            .When(x => !string.IsNullOrWhiteSpace(x.AccentColor))
            .WithMessage("AccentColor must be a #RRGGBB hex color.");

        RuleFor(x => x.JoinMessage).MaximumLength(280);
    }

    private static bool BeHttpUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

    private static bool BeHexColor(string? value)
    {
        if (value is not { Length: 7 } || value[0] != '#') return false;
        for (var i = 1; i < 7; i++)
            if (!char.IsAsciiHexDigit(value[i])) return false;
        return true;
    }
}
