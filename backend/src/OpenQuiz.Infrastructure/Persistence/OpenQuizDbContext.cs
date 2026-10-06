using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence;

public class OpenQuizDbContext : DbContext
{
    public OpenQuizDbContext(DbContextOptions<OpenQuizDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Poll> Polls => Set<Poll>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<Vote> Votes => Set<Vote>();
    public DbSet<OpenAnswer> OpenAnswers => Set<OpenAnswer>();
    public DbSet<WordCloudSubmission> WordCloudSubmissions => Set<WordCloudSubmission>();
    public DbSet<WordCloudAggregate> WordCloudAggregates => Set<WordCloudAggregate>();
    public DbSet<Score> Scores => Set<Score>();
    public DbSet<Reaction> Reactions => Set<Reaction>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<BillingAccount> BillingAccounts => Set<BillingAccount>();
    public DbSet<EntitlementOverride> EntitlementOverrides => Set<EntitlementOverride>();
    public DbSet<UsageCounter> UsageCounters => Set<UsageCounter>();
    public DbSet<BrandingSettings> BrandingSettings => Set<BrandingSettings>();
    public DbSet<ProcessedWebhookEvent> ProcessedWebhookEvents => Set<ProcessedWebhookEvent>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<PollCollaborator> PollCollaborators => Set<PollCollaborator>();
    public DbSet<QuestionBankItem> QuestionBankItems => Set<QuestionBankItem>();
    public DbSet<QuestionBankOption> QuestionBankOptions => Set<QuestionBankOption>();
    public DbSet<MediaFile> MediaFiles => Set<MediaFile>();

    /// <summary>
    /// ICU collation that ignores case (but not accents), so "Ali" and "ali"
    /// are one participant and one standings row, as they would be to a person
    /// reading the board. Equality and unique indexes honour it; LIKE does not,
    /// so these columns are only ever compared with <c>==</c>.
    /// </summary>
    public const string CaseInsensitiveCollation = "case_insensitive";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasCollation(CaseInsensitiveCollation, locale: "und-u-ks-level2", provider: "icu", deterministic: false);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OpenQuizDbContext).Assembly);

        // Participant names and e-mail addresses are identities people type,
        // so none of them should split on capitalisation.
        foreach (var property in modelBuilder.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(string) && p.Name is "UserName" or "Email"))
        {
            property.SetCollation(CaseInsensitiveCollation);
        }

        base.OnModelCreating(modelBuilder);
    }

    /// <summary>
    /// Every timestamp is stored as PostgreSQL <c>timestamptz</c>, which Npgsql
    /// only accepts as a UTC <see cref="DateTime"/>. Values from request bodies
    /// (a scheduled start sent without a "Z") arrive Unspecified or Local, so
    /// they are normalised on the way in; on the way out the Kind is pinned to
    /// UTC so JSON always carries the trailing Z the voter-screen countdown
    /// relies on.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        builder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
        base.ConfigureConventions(builder);
    }
}

internal static class UtcDateTimes
{
    public static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}

internal class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    value => UtcDateTimes.ToUtc(value),
    stored => DateTime.SpecifyKind(stored, DateTimeKind.Utc));

internal class NullableUtcDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
    value => value.HasValue ? UtcDateTimes.ToUtc(value.Value) : null,
    stored => stored.HasValue ? DateTime.SpecifyKind(stored.Value, DateTimeKind.Utc) : null);
