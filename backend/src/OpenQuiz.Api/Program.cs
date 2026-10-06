using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Api.Auth;
using OpenQuiz.Api.Diagnostics;
using OpenQuiz.Api.Hubs;
using Microsoft.AspNetCore.HttpOverrides;
using OpenQuiz.Api.Middleware;
using OpenQuiz.Api.RateLimiting;
using OpenQuiz.Api.Realtime;
using OpenQuiz.Application;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Infrastructure;
using OpenQuiz.Infrastructure.Options;
using OpenQuiz.Infrastructure.Persistence;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// --- Logging (Serilog) ---
// Console keeps `docker logs` useful; the rolling file survives a container
// restart, which is the only copy an operator has after a crash loop.
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// --- Services ---
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();
builder.Services.AddHostedService<OpenQuiz.Api.Hosting.SessionScheduler>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddOpenQuizHealthChecks();

// --- Metrics and traces (only when an exporter is configured) ---
var observability = builder.Configuration.GetSection(ObservabilityOptions.SectionName).Get<ObservabilityOptions>()
                    ?? new ObservabilityOptions();
builder.Services.AddOpenQuizObservability(observability);

// --- Realtime (optionally fanned out across API instances) ---
var realtime = builder.Configuration.GetSection(RealtimeOptions.SectionName).Get<RealtimeOptions>()
               ?? new RealtimeOptions();
builder.Services.AddOpenQuizRealtime(realtime);

// --- Rate limiting ---
var rateLimits = builder.Configuration.GetSection(RateLimitOptions.SectionName).Get<RateLimitOptions>()
                 ?? new RateLimitOptions();
builder.Services.AddOpenQuizRateLimiting(rateLimits);

if (rateLimits.TrustForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        o.ForwardLimit = Math.Max(1, rateLimits.ForwardLimit);
        // Container deployments do not know the proxy address up front; the
        // operator opts in to this only when the proxy is the sole entry point.
        o.KnownIPNetworks.Clear();
        o.KnownProxies.Clear();
    });
}

// --- AuthN/AuthZ ---
var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
var jwt = jwtSection.Get<JwtOptions>() ?? new JwtOptions();

var generatedDevSigningKey = false;

if (string.IsNullOrWhiteSpace(jwt.SigningKey))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Jwt:SigningKey must be configured.");

    jwt.SigningKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    generatedDevSigningKey = true;
}
else if (Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:SigningKey must be at least 32 bytes; HMAC-SHA256 rejects shorter keys.");
}

// JwtTokenService reads the key through IOptions<JwtOptions>, so a key that was
// generated or normalised here has to be pushed back into the options pipeline.
// Otherwise tokens are signed with a different key than the one validated below.
builder.Services.PostConfigure<JwtOptions>(o => o.SigningKey = jwt.SigningKey);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        // Allow JWT via query string for SignalR WebSocket handshake.
        opts.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    ctx.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// --- CORS ---
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

// --- Pipeline ---
var app = builder.Build();

app.Logger.LogInformation(
    realtime.UsesBackplane
        ? "SignalR is using the Redis backplane; this instance can be one of several."
        : "SignalR is running without a backplane. Run a single API instance, or set Realtime:RedisConnectionString.");

if (generatedDevSigningKey)
{
    app.Logger.LogWarning(
        "Jwt:SigningKey is not configured; a development key was generated. " +
        "Tokens issued by this process stop validating once it restarts.");
}

// Apply pending EF Core migrations on startup (self-hosted convenience).
if (builder.Configuration.GetValue("App:AutoMigrate", true))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<OpenQuizDbContext>();
    var attempts = 0;
    while (true)
    {
        try { await db.Database.MigrateAsync(); break; }
        catch (Exception ex) when (++attempts < 20)
        {
            app.Logger.LogWarning(ex, "Database not ready yet (attempt {Attempt}/20), retrying in 3 s…", attempts);
            await Task.Delay(3000);
        }
    }
}

if (rateLimits.TrustForwardedHeaders) app.UseForwardedHeaders();

app.UseSerilogRequestLogging(opts =>
{
    // Probes hit every few seconds forever. At Information they bury the
    // requests an operator is actually reading the log for.
    opts.GetLevel = (ctx, _, ex) =>
        ex is not null || ctx.Response.StatusCode >= 500 ? LogEventLevel.Error
        : ctx.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Debug
        : LogEventLevel.Information;
});
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
// After authentication so signed-in callers are partitioned by user id.
app.UseRateLimiter();

app.MapControllers();
app.MapOpenQuizHealthChecks();
app.MapOpenQuizMetrics(observability);
app.MapHub<PollHub>("/hubs/poll");

app.Run();

public partial class Program;
