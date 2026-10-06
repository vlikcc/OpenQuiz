using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

public class ProcessedWebhookEventConfiguration : IEntityTypeConfiguration<ProcessedWebhookEvent>
{
    public void Configure(EntityTypeBuilder<ProcessedWebhookEvent> b)
    {
        b.ToTable("ProcessedWebhookEvents");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).IsRequired().HasMaxLength(32);
        b.Property(x => x.EventId).IsRequired().HasMaxLength(128);

        b.HasIndex(x => new { x.Provider, x.EventId }).IsUnique();
    }
}
