using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class RateWindowConfiguration : IEntityTypeConfiguration<RateWindow>
{
    public void Configure(EntityTypeBuilder<RateWindow> builder)
    {
        builder.ToTable("rate_windows").HasKey(candidateRateWindow => new { candidateRateWindow.Identity, candidateRateWindow.Minute });
        builder.HasIndex(candidateRateWindow => candidateRateWindow.Minute);
    }
}
