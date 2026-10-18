namespace MockingBird.Configuration;

public static class ApplicationConfigurationExtensions
{
    public static WebApplicationBuilder AddApplicationConfiguration(this WebApplicationBuilder builder, string[] args)
    {
        // The default builder already loads appsettings.json and the environment-specific file.
        if (builder.Environment.IsDevelopment())
        {
            builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
            // Preserve the standard precedence of environment variables and command-line arguments.
            builder.Configuration.AddEnvironmentVariables();
            builder.Configuration.AddCommandLine(args);
        }

        return builder;
    }
}
