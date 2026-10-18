using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class CollectionSensitiveVariableConfiguration : IEntityTypeConfiguration<CollectionSensitiveVariable>
{
    public void Configure(EntityTypeBuilder<CollectionSensitiveVariable> builder)
    {
        builder.ToTable("collection_sensitive_variables").HasKey(candidateSensitiveVariable => new { candidateSensitiveVariable.Owner, candidateSensitiveVariable.CollectionId, candidateSensitiveVariable.Position });
        builder.HasOne(candidateSensitiveVariable => candidateSensitiveVariable.Collection).WithMany(candidateCollection => candidateCollection.SensitiveVariables).HasForeignKey(candidateSensitiveVariable => new { candidateSensitiveVariable.Owner, candidateSensitiveVariable.CollectionId }).OnDelete(DeleteBehavior.Cascade);
    }
}
