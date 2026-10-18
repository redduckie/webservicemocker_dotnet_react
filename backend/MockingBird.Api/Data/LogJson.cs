using System.Text.Json;
using MockingBird.Contracts;

namespace MockingBird.Data;
// A captured HTTP exchange is one document. Its bodies are raw strings so XML,
// JSON formatting, templates, and partial/invalid payloads are preserved.
public static class LogJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static string Serialize(LogDto value) => JsonSerializer.Serialize(value, Options);
    public static LogDto Deserialize(string value)
    {
        var log = JsonSerializer.Deserialize<LogDto>(value, Options) ?? throw new JsonException("Missing log document.");
        return log with
        {
            RequestHeaders = log.RequestHeaders ?? [],
            RequestBody = log.RequestBody ?? "",
            ResponseBody = log.ResponseBody ?? ""
        };
    }
}
