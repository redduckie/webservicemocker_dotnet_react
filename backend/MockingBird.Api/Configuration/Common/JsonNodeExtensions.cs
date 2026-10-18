using System.Text.Json.Nodes;

namespace MockingBird.Common;

public static class JsonNodeExtensions
{
    // Dynamic nodes are used only by the arbitrary HTTP body/template engine.
    public static JsonNode? Copy(this JsonNode? jsonNode) => jsonNode?.DeepClone();
}
