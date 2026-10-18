using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class CollectionRequestHeaderConfiguration : IEntityTypeConfiguration<CollectionRequestHeader>
{
    public void Configure(EntityTypeBuilder<CollectionRequestHeader> builder)
    {
        builder.ToTable("collection_request_headers").HasKey(candidateHeader => new { candidateHeader.Owner, candidateHeader.CollectionId, candidateHeader.RequestId, candidateHeader.Position });
        builder.HasOne(candidateHeader => candidateHeader.Request).WithMany(candidateCollectionRequest => candidateCollectionRequest.Headers).HasForeignKey(candidateHeader => new { candidateHeader.Owner, candidateHeader.CollectionId, candidateHeader.RequestId }).OnDelete(DeleteBehavior.Cascade);
    }
}
