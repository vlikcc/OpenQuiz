using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OpenQuiz.Infrastructure.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<OpenQuizDbContext>
{
    public OpenQuizDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("OPENQUIZ_DESIGN_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=openquiz;Username=openquiz;Password=openquiz";

        var builder = new DbContextOptionsBuilder<OpenQuizDbContext>()
            .UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(OpenQuizDbContext).Assembly.FullName));

        return new OpenQuizDbContext(builder.Options);
    }
}
