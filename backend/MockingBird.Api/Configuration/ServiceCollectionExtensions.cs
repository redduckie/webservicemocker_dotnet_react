using MockingBird.Infrastructure.Database;
using MockingBird.Services;
using MockingBird.Infrastructure.Http;
using MockingBird.Infrastructure.Security;
using MockingBird.Data;
using Microsoft.EntityFrameworkCore;

namespace MockingBird.Configuration;

public static class ServiceCollectionExtensions
{
    public static WebApplicationBuilder AddApiServices(this WebApplicationBuilder builder)
    {
        builder.WebHost.ConfigureKestrel(candidateOperation => candidateOperation.Limits.MaxRequestBodySize = 8 * 1024 * 1024);
        builder.Services.AddHttpClient("store", context => context.Timeout = TimeSpan.FromSeconds(30)).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddDbContext<MockingBirdDbContext>(candidateOperation => candidateOperation.UseNpgsql(PostgresConnection.FromConfiguration(builder.Configuration)));
        builder.Services.ConfigureHttpJsonOptions(candidateOperation => candidateOperation.SerializerOptions.RespectNullableAnnotations = true);
        builder.Services.AddScoped<IdentityService>();
        builder.Services.AddSingleton<CollectionCipher>();
        builder.Services.AddScoped<CollectionService>();
        builder.Services.AddScoped<ProjectService>();
        builder.Services.AddScoped<SettingsService>();
        builder.Services.AddScoped<SafeHttpClient>();
        builder.Services.AddScoped<MockService>();
        return builder;
    }
}
