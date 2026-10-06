namespace OpenQuiz.Domain.Entities;

/// <summary>
/// Insert-first idempotency for provider webhooks. The unique
/// <c>(Provider, EventId)</c> index is the guarantee: a retry that loses the
/// insert is treated as already handled and answered 200 so the provider
/// stops retrying. <see cref="ProcessedAt"/> is written after the side
/// effects; a crash between insert and this stamp is re-driven on the next
/// delivery (the unique row is reused, not skipped).
/// </summary>
public class ProcessedWebhookEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Provider { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;

    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}
