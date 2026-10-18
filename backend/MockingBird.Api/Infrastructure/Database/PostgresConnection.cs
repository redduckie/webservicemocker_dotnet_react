using Npgsql;

namespace MockingBird.Infrastructure.Database;

public static class PostgresConnection
{
    public static string FromConfiguration(IConfiguration config)
    {
        var value = config.GetConnectionString("Supabase");
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Set ConnectionStrings:Supabase to the PostgreSQL connection string.");
        if (!value.StartsWith("postgres://") && !value.StartsWith("postgresql://"))
            return value;
        var uri = new Uri(value);
        var user = uri.UserInfo.Split(':', 2);
        return new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Username = Uri.UnescapeDataString(user[0]),
            Password = user.Length > 1 ? Uri.UnescapeDataString(user[1]) : "",
            Database = uri.AbsolutePath.TrimStart('/'),
            SslMode = SslMode.VerifyFull,
            Timeout = 15,
            CommandTimeout = 30,
            MaxPoolSize = 20,
            RootCertificate = (string.IsNullOrWhiteSpace(config["Database:RootCertificate"]) ? null : config["Database:RootCertificate"]) ?? Path.Combine(AppContext.BaseDirectory, "certificates", "supabase-ca.crt")
        }.ConnectionString;
    }
}
