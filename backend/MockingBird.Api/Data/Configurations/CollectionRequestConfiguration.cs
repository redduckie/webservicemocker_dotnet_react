using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class CollectionRequestConfiguration : IEntityTypeConfiguration<CollectionRequest>
{
    public void Configure(EntityTypeBuilder<CollectionRequest> builder)
    {
        builder.ToTable("collection_requests").HasKey(candidateCollectionRequest => new { candidateCollectionRequest.Owner, candidateCollectionRequest.CollectionId, candidateCollectionRequest.Id });
        builder.HasOne(candidateCollectionRequest => candidateCollectionRequest.Collection).WithMany(candidateCollection => candidateCollection.Requests).HasForeignKey(candidateCollectionRequest => new { candidateCollectionRequest.Owner, candidateCollectionRequest.CollectionId }).OnDelete(DeleteBehavior.Cascade);
    }
}
