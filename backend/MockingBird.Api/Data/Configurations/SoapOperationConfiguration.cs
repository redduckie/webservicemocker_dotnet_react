using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class SoapOperationConfiguration : IEntityTypeConfiguration<SoapOperation>
{
    public void Configure(EntityTypeBuilder<SoapOperation> builder)
    {
        builder.ToTable("soap_operations").HasKey(candidateOperation => new { candidateOperation.ProjectId, candidateOperation.Name });
        builder.HasOne(candidateOperation => candidateOperation.Project).WithMany(candidateProject => candidateProject.Operations).HasForeignKey(candidateOperation => new { candidateOperation.Kind, candidateOperation.ProjectId }).OnDelete(DeleteBehavior.Cascade);
    }
}
