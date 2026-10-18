using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class CollectionRequestOperationConfiguration : IEntityTypeConfiguration<CollectionRequestOperation>
{
    public void Configure(EntityTypeBuilder<CollectionRequestOperation> builder)
    {
        builder.ToTable("collection_request_operations").HasKey(candidateOperation => new { candidateOperation.Owner, candidateOperation.CollectionId, candidateOperation.RequestId, candidateOperation.Position });
        builder.HasOne(candidateOperation => candidateOperation.Request).WithMany(candidateCollectionRequest => candidateCollectionRequest.Operations).HasForeignKey(candidateOperation => new { candidateOperation.Owner, candidateOperation.CollectionId, candidateOperation.RequestId }).OnDelete(DeleteBehavior.Cascade);
    }
}
