using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class UserFeatureConfiguration : IEntityTypeConfiguration<UserFeature>
{
    public void Configure(EntityTypeBuilder<UserFeature> builder)
    {
        builder.ToTable("user_features").HasKey(candidateUserFeature => new { candidateUserFeature.UserId, candidateUserFeature.Feature });
        builder.HasOne(candidateUserFeature => candidateUserFeature.User).WithMany(candidateUser => candidateUser.Features).HasForeignKey(candidateUserFeature => candidateUserFeature.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
