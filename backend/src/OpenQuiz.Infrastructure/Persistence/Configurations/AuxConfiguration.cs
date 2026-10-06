using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenQuiz.Domain.Entities;

namespace OpenQuiz.Infrastructure.Persistence.Configurations;

// (Placeholder for any cross-entity helpers — kept for future use.)
internal static class AuxConfiguration
{
    public static EntityTypeBuilder<T> ConfigureAuditTimestamps<T>(this EntityTypeBuilder<T> b) where T : class => b;
}
