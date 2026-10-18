using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class EndpointResponseHeaderConfiguration : IEntityTypeConfiguration<EndpointResponseHeader>
{
    public void Configure(EntityTypeBuilder<EndpointResponseHeader> builder)
    {
        builder.ToTable("endpoint_response_headers").HasKey(candidateHeader => new { candidateHeader.ProjectId, candidateHeader.EndpointId, candidateHeader.Name });
        builder.HasOne(candidateHeader => candidateHeader.Endpoint).WithMany(candidateEndpoint => candidateEndpoint.ResponseHeaders).HasForeignKey(candidateHeader => new { candidateHeader.ProjectId, candidateHeader.EndpointId }).OnDelete(DeleteBehavior.Cascade);
    }
}
