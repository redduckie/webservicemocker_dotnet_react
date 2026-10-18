using MockingBird.Data.Entities;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace MockingBird.Data;

public class MockingBirdDbContext(DbContextOptions<MockingBirdDbContext> options) : DbContext(options)
{
    public DbSet<AccessUser> Users => Set<AccessUser>();
    public DbSet<MockProject> Projects => Set<MockProject>();
    public DbSet<RestEndpoint> Endpoints => Set<RestEndpoint>();
    public DbSet<SoapOperation> Operations => Set<SoapOperation>();
    public DbSet<RequestCollection> Collections => Set<RequestCollection>();
    public DbSet<CollectionRequest> Requests => Set<CollectionRequest>();
    public DbSet<RequestLog> Logs => Set<RequestLog>();
    public DbSet<SystemSettings> Settings => Set<SystemSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("mockingbird");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MockingBirdDbContext).Assembly);
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties())
                property.SetColumnName(Regex.Replace(property.Name, "([a-z0-9])([A-Z])", "$1_$2").ToLowerInvariant());
    }
}
