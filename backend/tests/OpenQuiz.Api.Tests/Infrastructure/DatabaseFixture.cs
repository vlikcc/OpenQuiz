using Microsoft.EntityFrameworkCore;
using Npgsql;
using OpenQuiz.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

namespace OpenQuiz.Api.Tests.Infrastructure;

/// <summary>
/// Owns the PostgreSQL server the whole suite talks to and applies the
/// migrations once. A throwaway container is the default so CI needs no setup,
/// but pointing OPENQUIZ_TEST_DB at an existing server keeps the suite usable
/// on machines where Docker is not available.
/// </summary>
public sealed class DatabaseFixture : IAsyncLifetime
{
    public const string EnvironmentVariable = "OPENQUIZ_TEST_DB";

    private const string DatabaseName = "openquiz_tests";

    // Same major version as docker-compose.yml, so the suite exercises the
    // server production runs (ICU collations included).
    private const string PostgresImage = "postgres:17-alpine";

    private PostgreSqlContainer? _container;

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable(EnvironmentVariable);

        if (string.IsNullOrWhiteSpace(server))
        {
            _container = new PostgreSqlBuilder(PostgresImage).Build();
            await _container.StartAsync();
            server = _container.GetConnectionString();
        }

        ConnectionString = new NpgsqlConnectionStringBuilder(server)
        {
            Database = DatabaseName,
        }.ConnectionString;

        // A reused server may still hold the previous run's rows, and tests that
        // assert on counts need a known starting point.
        await using var db = CreateDbContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_container is not null) await _container.DisposeAsync();
    }

    public OpenQuizDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<OpenQuizDbContext>()
            .UseNpgsql(ConnectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(OpenQuizDbContext).Assembly.FullName))
            .Options;

        return new OpenQuizDbContext(options);
    }
}

/// <summary>
/// Every test class joins this collection so the database is built once and the
/// classes never race each other over the shared schema.
/// </summary>
[CollectionDefinition(Name)]
public sealed class DatabaseCollection : ICollectionFixture<DatabaseFixture>
{
    public const string Name = "database";
}
