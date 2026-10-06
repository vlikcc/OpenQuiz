using System.Collections.Concurrent;

namespace OpenQuiz.Api.Realtime;

/// <summary>
/// Coalesces broadcast events per key into at most one delivery every <see cref="WindowMs"/> ms.
/// Latest payload wins; stale payloads are dropped.
/// </summary>
public class RealtimeThrottle
{
    public const int WindowMs = 250;

    private readonly ConcurrentDictionary<string, Slot> _slots = new();

    public Task Coalesce<T>(string key, T payload, Func<T, Task> send)
    {
        var slot = _slots.GetOrAdd(key, _ => new Slot());
        lock (slot)
        {
            slot.Latest = payload!;
            slot.Sender = obj => send((T)obj);
            if (slot.Pending) return Task.CompletedTask;
            slot.Pending = true;
        }
        _ = Task.Run(async () =>
        {
            await Task.Delay(WindowMs);
            object snapshot;
            Func<object, Task> sender;
            lock (slot) { snapshot = slot.Latest!; sender = slot.Sender!; slot.Pending = false; }
            try { await sender(snapshot); } catch { /* swallow; logger optional */ }
        });
        return Task.CompletedTask;
    }

    private sealed class Slot
    {
        public object? Latest;
        public Func<object, Task>? Sender;
        public bool Pending;
    }
}
