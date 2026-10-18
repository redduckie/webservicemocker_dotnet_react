using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class RequestCollectionConfiguration : IEntityTypeConfiguration<RequestCollection>
{
    public void Configure(EntityTypeBuilder<RequestCollection> builder)
    {
        builder.ToTable("collections").HasKey(candidateCollection => new { candidateCollection.Owner, candidateCollection.Id });
        builder.Property(candidateCollection => candidateCollection.Revision).IsConcurrencyToken();
        builder.HasOne(candidateCollection => candidateCollection.User).WithMany(candidateUser => candidateUser.Collections).HasForeignKey(candidateCollection => candidateCollection.Owner).OnDelete(DeleteBehavior.Restrict);
    }
}
