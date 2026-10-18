using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class RequestLogConfiguration : IEntityTypeConfiguration<RequestLog>
{
    public void Configure(EntityTypeBuilder<RequestLog> builder)
    {
        builder.ToTable("request_logs").HasKey(candidateRequestLog => new { candidateRequestLog.Kind, candidateRequestLog.ProjectId, candidateRequestLog.Id });
        builder.HasOne(candidateRequestLog => candidateRequestLog.Project).WithMany(candidateProject => candidateProject.Logs).HasForeignKey(candidateRequestLog => new { candidateRequestLog.Kind, candidateRequestLog.ProjectId }).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(candidateRequestLog => new { candidateRequestLog.Kind, candidateRequestLog.ProjectId, candidateRequestLog.RecordedAt, candidateRequestLog.Id });
        builder.HasIndex(candidateRequestLog => candidateRequestLog.ExpiresAt);
        builder.Property(candidateRequestLog => candidateRequestLog.Data).HasColumnType("jsonb").HasConversion(value => LogJson.Serialize(value), value => LogJson.Deserialize(value));
    }
}
