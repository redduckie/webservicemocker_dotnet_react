using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class MockProjectConfiguration : IEntityTypeConfiguration<MockProject>
{
    public void Configure(EntityTypeBuilder<MockProject> builder)
    {
        builder.ToTable("projects").HasKey(candidateProject => new { candidateProject.Kind, candidateProject.Id });
        builder.HasOne(candidateProject => candidateProject.User).WithMany(candidateUser => candidateUser.Projects).HasForeignKey(candidateProject => candidateProject.Owner).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(candidateProject => new { candidateProject.Owner, candidateProject.Kind });
    }
}
