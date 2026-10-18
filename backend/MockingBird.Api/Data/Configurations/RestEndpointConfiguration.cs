using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class RestEndpointConfiguration : IEntityTypeConfiguration<RestEndpoint>
{
    public void Configure(EntityTypeBuilder<RestEndpoint> builder)
    {
        builder.ToTable("rest_endpoints").HasKey(candidateEndpoint => new { candidateEndpoint.ProjectId, candidateEndpoint.Id });
        builder.HasOne(candidateEndpoint => candidateEndpoint.Project).WithMany(candidateProject => candidateProject.Endpoints).HasForeignKey(candidateEndpoint => new { candidateEndpoint.Kind, candidateEndpoint.ProjectId }).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(candidateEndpoint => new { candidateEndpoint.ProjectId, candidateEndpoint.Method, candidateEndpoint.Path });
    }
}
