using Google.Cloud.Firestore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenQuiz.DataImport;
using OpenQuiz.Infrastructure.Persistence;
using Spectre.Console;

var config = new ConfigurationBuilder()
    .AddEnvironmentVariables()
    .AddCommandLine(args)
    .Build();

var firebaseProject = config["FirebaseProjectId"]
    ?? Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID");
var credentials = config["GoogleCredentials"]
    ?? Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
var connectionString = config["ConnectionString"]
    ?? Environment.GetEnvironmentVariable("OPENQUIZ_CONNECTION");
var appId = config["AppId"] ?? "quiz-master-pro";
var dryRun = string.Equals(config["DryRun"], "true", StringComparison.OrdinalIgnoreCase);

if (string.IsNullOrWhiteSpace(firebaseProject) || string.IsNullOrWhiteSpace(connectionString))
{
    AnsiConsole.MarkupLine("[red bold]OpenQuiz DataImport — Firestore → PostgreSQL Migration Tool[/]");
    AnsiConsole.WriteLine();
    AnsiConsole.MarkupLine("[yellow]Usage:[/]");
    AnsiConsole.WriteLine("  dotnet run --project tools/OpenQuiz.DataImport -- \\");
    AnsiConsole.WriteLine("    --FirebaseProjectId=openquiz-c9a0c \\");
    AnsiConsole.WriteLine("    --GoogleCredentials=/path/to/service-account.json \\");
    AnsiConsole.WriteLine("    --ConnectionString=\"Host=localhost;Port=5432;Database=openquiz;Username=openquiz;Password=…\" \\");
    AnsiConsole.WriteLine("    [--AppId=quiz-master-pro] [--DryRun=true]");
    AnsiConsole.WriteLine();
    AnsiConsole.MarkupLine("[dim]Required: FirebaseProjectId, ConnectionString[/]");
    AnsiConsole.MarkupLine("[dim]Optional: GoogleCredentials (or GOOGLE_APPLICATION_CREDENTIALS env), AppId, DryRun[/]");
    return 1;
}

if (!string.IsNullOrWhiteSpace(credentials))
    Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", credentials);

// Header
AnsiConsole.Write(new Rule("[bold blue]OpenQuiz DataImport[/]").RuleStyle("blue"));
AnsiConsole.WriteLine();

var infoTable = new Table().Border(TableBorder.Rounded).AddColumn("Parameter").AddColumn("Value");
infoTable.AddRow("Firebase project", firebaseProject);
infoTable.AddRow("App id", appId);
infoTable.AddRow("Dry-run", dryRun ? "[yellow]YES[/]" : "[green]NO[/]");
infoTable.AddRow("Connection", connectionString.Length > 60 ? connectionString[..60] + "…" : connectionString);
AnsiConsole.Write(infoTable);
AnsiConsole.WriteLine();

try
{
    // Connect to Firestore
    FirestoreDb firestore;
    await AnsiConsole.Status()
        .Spinner(Spinner.Known.Dots)
        .StartAsync("Connecting to Firestore...", async ctx =>
        {
            // assignment happens via closure
            await Task.CompletedTask;
        });

    firestore = await FirestoreDb.CreateAsync(firebaseProject);
    AnsiConsole.MarkupLine("[green]✓[/] Connected to Firestore");

    var rootPath = $"artifacts/{appId}/public/data";

    // Connect to PostgreSQL
    var dbOptions = new DbContextOptionsBuilder<OpenQuizDbContext>()
        .UseNpgsql(connectionString)
        .Options;
    using var db = new OpenQuizDbContext(dbOptions);

    if (!dryRun)
    {
        await AnsiConsole.Status()
            .Spinner(Spinner.Known.Dots)
            .StartAsync("Applying database migrations...", async _ =>
            {
                await db.Database.MigrateAsync();
            });
        AnsiConsole.MarkupLine("[green]✓[/] Database migrations applied");
    }

    AnsiConsole.WriteLine();
    var importer = new Importer(firestore, db, rootPath);

    // Import Users
    AnsiConsole.MarkupLine("[bold]1/5[/] Importing users...");
    var usersResult = await importer.ImportUsersAsync(dryRun, msg => AnsiConsole.MarkupLine($"  [dim]{Markup.Escape(msg)}[/]"));
    var userMap = usersResult.map;
    var userResult = usersResult.result;
    AnsiConsole.MarkupLine($"  Users: [green]{userResult.Imported} imported[/], [yellow]{userResult.Skipped} skipped[/], [red]{userResult.Errors} errors[/]");

    // Import Polls
    AnsiConsole.MarkupLine("[bold]2/5[/] Importing polls...");
    var pollsResult = await importer.ImportPollsAsync(userMap, dryRun, msg => AnsiConsole.MarkupLine($"  [dim]{Markup.Escape(msg)}[/]"));
    var pollMap = pollsResult.map;
    var pollResult = pollsResult.result;
    AnsiConsole.MarkupLine($"  Polls: [green]{pollResult.Imported} imported[/], [yellow]{pollResult.Skipped} skipped[/], [red]{pollResult.Errors} errors[/]");

    // Import Votes
    AnsiConsole.MarkupLine("[bold]3/5[/] Importing votes...");
    var voteResult = await importer.ImportVotesAsync(pollMap, dryRun, msg => AnsiConsole.MarkupLine($"  [dim]{Markup.Escape(msg)}[/]"));
    AnsiConsole.MarkupLine($"  Votes: [green]{voteResult.Imported} imported[/], [yellow]{voteResult.Skipped} skipped[/], [red]{voteResult.Errors} errors[/]");

    // Import per-poll standings (needs the votes above for polls without a scores subcollection)
    AnsiConsole.MarkupLine("[bold]4/5[/] Importing per-poll standings...");
    var pollScoreResult = await importer.ImportPollScoresAsync(pollMap, dryRun, msg => AnsiConsole.MarkupLine($"  [dim]{Markup.Escape(msg)}[/]"));
    AnsiConsole.MarkupLine($"  Standings: [green]{pollScoreResult.Imported} imported[/], [yellow]{pollScoreResult.Skipped} skipped[/], [red]{pollScoreResult.Errors} errors[/]");

    // Import the legacy global leaderboard
    AnsiConsole.MarkupLine("[bold]5/5[/] Importing legacy global scores...");
    var globalScoreResult = await importer.ImportScoresAsync(dryRun, msg => AnsiConsole.MarkupLine($"  [dim]{Markup.Escape(msg)}[/]"));
    AnsiConsole.MarkupLine($"  Scores: [green]{globalScoreResult.Imported} imported[/], [yellow]{globalScoreResult.Skipped} skipped[/], [red]{globalScoreResult.Errors} errors[/]");
    var scoreResult = new ImportResult(
        pollScoreResult.Imported + globalScoreResult.Imported,
        pollScoreResult.Skipped + globalScoreResult.Skipped,
        pollScoreResult.Errors + globalScoreResult.Errors);

    // Summary
    AnsiConsole.WriteLine();
    AnsiConsole.Write(new Rule("[bold]Summary[/]").RuleStyle("green"));

    var summary = new Table()
        .Border(TableBorder.Rounded)
        .AddColumn("Entity")
        .AddColumn(new TableColumn("Imported").Centered())
        .AddColumn(new TableColumn("Skipped").Centered())
        .AddColumn(new TableColumn("Errors").Centered())
        .AddColumn(new TableColumn("Total").Centered());

    void AddRow(string label, ImportResult r) =>
        summary.AddRow(label,
            $"[green]{r.Imported}[/]",
            $"[yellow]{r.Skipped}[/]",
            r.Errors > 0 ? $"[red]{r.Errors}[/]" : $"[dim]{r.Errors}[/]",
            r.Total.ToString());

    AddRow("Users", userResult);
    AddRow("Polls", pollResult);
    AddRow("Votes", voteResult);
    AddRow("Scores", scoreResult);

    var totalImported = userResult.Imported + pollResult.Imported + voteResult.Imported + scoreResult.Imported;
    var totalErrors = userResult.Errors + pollResult.Errors + voteResult.Errors + scoreResult.Errors;
    summary.AddEmptyRow();
    summary.AddRow("[bold]Total[/]",
        $"[bold green]{totalImported}[/]",
        $"[bold yellow]{userResult.Skipped + pollResult.Skipped + voteResult.Skipped + scoreResult.Skipped}[/]",
        totalErrors > 0 ? $"[bold red]{totalErrors}[/]" : $"[dim]{totalErrors}[/]",
        (userResult.Total + pollResult.Total + voteResult.Total + scoreResult.Total).ToString());

    AnsiConsole.Write(summary);
    AnsiConsole.WriteLine();

    if (dryRun)
        AnsiConsole.MarkupLine("[yellow bold]⚠ Dry-run complete — no rows were written to the database.[/]");
    else if (totalErrors > 0)
        AnsiConsole.MarkupLine("[yellow bold]⚠ Import complete with errors. Review the messages above.[/]");
    else
        AnsiConsole.MarkupLine("[green bold]✓ Import complete![/]");

    return totalErrors > 0 ? 2 : 0;
}
catch (Exception ex)
{
    AnsiConsole.WriteException(ex, ExceptionFormats.ShortenEverything);
    return 1;
}
