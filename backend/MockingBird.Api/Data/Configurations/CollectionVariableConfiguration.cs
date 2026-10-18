using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class CollectionVariableConfiguration : IEntityTypeConfiguration<CollectionVariable>
{
    public void Configure(EntityTypeBuilder<CollectionVariable> builder)
    {
        builder.ToTable("collection_variables").HasKey(candidateVariable => new { candidateVariable.Owner, candidateVariable.CollectionId, candidateVariable.Position });
        builder.HasOne(candidateVariable => candidateVariable.Collection).WithMany(candidateCollection => candidateCollection.Variables).HasForeignKey(candidateVariable => new { candidateVariable.Owner, candidateVariable.CollectionId }).OnDelete(DeleteBehavior.Cascade);
    }
}
