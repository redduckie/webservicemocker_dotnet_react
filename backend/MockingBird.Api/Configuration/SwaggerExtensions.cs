using Microsoft.OpenApi;

namespace MockingBird.Configuration;

public static class SwaggerExtensions
{
    public static WebApplicationBuilder AddApiDocumentation(this WebApplicationBuilder builder)
    {
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "MockingBird API",
                Version = "v1",
                Description = "Administration, mock projects, request collections, and mock execution."
            });
        });

        return builder;
    }

    public static WebApplication UseApiDocumentation(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI(options =>
            {
                options.DocumentTitle = "MockingBird API — Swagger";
                options.SwaggerEndpoint("/swagger/v1/swagger.json", "MockingBird API v1");
            });
        }

        return app;
    }
}
