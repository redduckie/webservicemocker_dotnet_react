namespace MockingBird.Common;

public static class ApplicationValues
{
    public static string Now() => DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
    public static string Id() => Guid.NewGuid().ToString();
}
