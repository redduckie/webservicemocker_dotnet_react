using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MockingBird.Data.Entities;

namespace MockingBird.Data.Configurations;

public sealed class SystemSettingsConfiguration : IEntityTypeConfiguration<SystemSettings>
{
    public void Configure(EntityTypeBuilder<SystemSettings> builder)
    {
        builder.ToTable("settings").HasKey(settings => settings.Id);
        builder.Property(settings => settings.Id).ValueGeneratedNever();
    }
}
