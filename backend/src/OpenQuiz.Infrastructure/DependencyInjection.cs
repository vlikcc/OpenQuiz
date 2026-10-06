using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Infrastructure.Auth;
using OpenQuiz.Infrastructure.Email;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Payments;
using OpenQuiz.Infrastructure.Persistence;
using OpenQuiz.Infrastructure.Services;

namespace OpenQuiz.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<JwtOptions>(config.GetSection(JwtOptions.SectionName));
        services.Configure<GoogleAuthOptions>(config.GetSection(GoogleAuthOptions.SectionName));
        services.Configure<SmtpOptions>(config.GetSection(SmtpOptions.SectionName));
        services.Configure<AppOptions>(config.GetSection(AppOptions.SectionName));
        services.Configure<BillingOptions>(config.GetSection(BillingOptions.SectionName));
        services.Configure<MediaOptions>(config.GetSection(MediaOptions.SectionName));

        var connectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        services.AddDbContext<OpenQuizDbContext>(opt =>
            opt.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(OpenQuizDbContext).Assembly.FullName)));

        // The entitlement engine caches resolved plans for a short TTL
        // (EntitlementService) — not registered anywhere else in this project.
        services.AddMemoryCache();

        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<IGoogleTokenVerifier, GoogleTokenVerifier>();
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<IEmailSender, MailKitEmailSender>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPollService, PollService>();
        services.AddScoped<IVoteService, VoteService>();
        services.AddScoped<IScoreService, ScoreService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IWordCloudService, WordCloudService>();
        services.AddScoped<IReactionService, ReactionService>();
        services.AddScoped<IPlanResolver, PlanResolver>();
        services.AddScoped<IEntitlementService, EntitlementService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IBrandingService, BrandingService>();
        services.AddSingleton<IPaymentProvider, ManualPaymentProvider>();
        services.AddSingleton<IPaymentProviderRegistry, PaymentProviderRegistry>();
        services.AddScoped<IPaymentWebhookService, PaymentWebhookService>();
        services.AddScoped<IMediaService, MediaService>();
        services.AddScoped<IQuestionBankService, QuestionBankService>();

        return services;
    }
}
