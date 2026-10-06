using OpenQuiz.Application.Abstractions;

namespace OpenQuiz.Api.Realtime;

public class RealtimeOptions
{
    public const string SectionName = "Realtime";

    /// <summary>
    /// StackExchange.Redis connection string. Left blank the hub keeps its
    /// groups in process memory, which is correct for a single API instance and
    /// wrong for several: a participant connected to one instance would never
    /// hear an event published by another.
    /// </summary>
    public string? RedisConnectionString { get; set; }

    /// <summary>
    /// Prefix for the Redis channels. Only matters when several deployments
    /// share one Redis.
    /// </summary>
    public string ChannelPrefix { get; set; } = "openquiz";

    public bool UsesBackplane => !string.IsNullOrWhiteSpace(RedisConnectionString);
}

public static class RealtimeScaleOutExtensions
{
    /// <summary>
    /// Registers SignalR, fanning out through Redis when one is configured.
    /// </summary>
    public static IServiceCollection AddOpenQuizRealtime(this IServiceCollection services, RealtimeOptions options)
    {
        var signalR = services.AddSignalR();

        if (options.UsesBackplane)
        {
            signalR.AddStackExchangeRedis(options.RedisConnectionString!, redis =>
                redis.Configuration.ChannelPrefix =
                    StackExchange.Redis.RedisChannel.Literal(options.ChannelPrefix));
        }

        services.AddSingleton<RealtimeThrottle>();
        services.AddSingleton<IRealtimeNotifier, SignalRRealtimeNotifier>();

        return services;
    }
}
