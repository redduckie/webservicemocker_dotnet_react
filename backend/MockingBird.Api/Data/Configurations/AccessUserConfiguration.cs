using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class AccessUserConfiguration : IEntityTypeConfiguration<AccessUser>
{
    public void Configure(EntityTypeBuilder<AccessUser> builder)
    {
        builder.ToTable("access_users").HasKey(candidateUser => candidateUser.Id);
        builder.HasIndex(candidateUser => candidateUser.Email).IsUnique();
        builder.HasIndex(candidateUser => candidateUser.EncryptionScope).IsUnique();
        builder.HasIndex(candidateUser => candidateUser.ApiKey).IsUnique();
        builder.HasIndex(candidateUser => candidateUser.Status);
    }
}
