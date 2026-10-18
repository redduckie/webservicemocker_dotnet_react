using MockingBird.Common;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace MockingBird.Infrastructure.Templating;

public static class Template
{
    public static XDocument Xml(string text)
    {
        using var reader = XmlReader.Create(new StringReader(text), new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 4_000_000 });
        return XDocument.Load(reader);
    }

    public static JsonNode? ParseBody(string body, string type)
    {
        if (string.IsNullOrWhiteSpace(body))
            return new JsonObject();
        try
        {
            if (type.Contains("json"))
                return JsonNode.Parse(body, new JsonNodeOptions(), new JsonDocumentOptions { MaxDepth = 100 });
            if (type.Contains("xml"))
            {
                var document = Xml(body);
                return new JsonObject
                {
                    [document.Root!.Name.LocalName] = Element(document.Root)
                };
            }

            var jsonObject = new JsonObject();
            foreach (var pair in body.Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var formParts = pair.Split('=', 2);
                var name = Uri.UnescapeDataString(formParts[0].Replace('+', ' '));
                var value = Uri.UnescapeDataString((formParts.Length > 1 ? formParts[1] : "").Replace('+', ' '));
                if (jsonObject[name] is JsonArray jsonArray)
                    jsonArray.Add(value);
                else if (jsonObject.ContainsKey(name))
                {
                    var previousValue = jsonObject[name].Copy();
                    jsonObject[name] = new JsonArray(previousValue, JsonValue.Create(value));
                }
                else
                    jsonObject[name] = value;
            }

            return jsonObject;
        }
        catch (Exception exception) when (exception is JsonException or XmlException or UriFormatException)
        {
            throw new ApiException(400, "The body is not valid " + type + ".");
        }
    }

    static JsonNode Element(XElement element)
    {
        if (!element.HasElements && !element.HasAttributes)
            return JsonValue.Create(element.Value.Trim())!;
        var jsonObject = new JsonObject();
        foreach (var attribute in element.Attributes().Where(candidateAttribute => !candidateAttribute.IsNamespaceDeclaration))
            jsonObject["@_" + attribute.Name.LocalName] = attribute.Value;
        foreach (var group in element.Elements().GroupBy(candidateElement => candidateElement.Name.LocalName))
            jsonObject[group.Key] = group.Count() == 1 ? Element(group.First()) : new JsonArray(group.Select(Element).ToArray());
        if (!element.HasElements && !string.IsNullOrWhiteSpace(element.Value))
            jsonObject["#text"] = element.Value.Trim();
        return jsonObject;
    }

    record Node(string Kind, string Value, List<Node>? Children = null);
    record Context(JsonNode? Value, JsonNode Root, Context? Parent = null, int? Index = null, int Length = 0);
    static readonly Regex Token = new(@"\{\{\s*([^{}]+?)\s*\}\}", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));
    static List<Node> Compile(string template)
    {
        var root = new List<Node>();
        var current = root;
        var stack = new Stack<List<Node>>();
        int position = 0;
        foreach (Match match in Token.Matches(template))
        {
            if (match.Index > position)
                current.Add(new("text", template[position..match.Index]));
            var expression = match.Groups[1].Value.Trim();
            if (expression.StartsWith("#each "))
            {
                var path = expression[6..].Trim();
                ValidatePath(path);
                var children = new List<Node>();
                current.Add(new("each", path, children));
                stack.Push(current);
                if (stack.Count > 10)
                    throw new ApiException(400, "Template loops cannot nest more than 10 levels.");
                current = children;
            }
            else if (expression == "/each")
            {
                if (stack.Count == 0)
                    throw new ApiException(400, "Unexpected {{/each}}.");
                current = stack.Pop();
            }
            else
            {
                ValidatePath(expression.StartsWith("json ") ? expression[5..].Trim() : expression.StartsWith("length ") ? expression[7..].Trim() : expression);
                current.Add(new("expression", expression));
            }

            position = match.Index + match.Length;
        }

        if (position < template.Length)
            current.Add(new("text", template[position..]));
        if (stack.Count > 0)
            throw new ApiException(400, "Missing {{/each}}.");
        return root;
    }

    static void ValidatePath(string path)
    {
        if (!Regex.IsMatch(path, @"^(?:\.\./)*(?:this|@[a-z]+|[A-Za-z0-9_$-]+)(?:(?:\.[A-Za-z0-9_$*-]+)|(?:\[(?:\d+|\*)\]))*$") || new[]
        {
            "__proto__",
            "prototype",
            "constructor"
        }.Any(pathToken => Tokens(path).Contains(pathToken)))
            throw new ApiException(400, "Invalid template path: " + path);
    }

    static string[] Tokens(string path) => Regex.Replace(path, @"\[(\d+|\*)\]", ".$1").Split('.', StringSplitOptions.RemoveEmptyEntries);
    static (bool found, JsonNode? value) Parts(JsonNode? value, string[] parts, int pathPartIndex = 0)
    {
        if (pathPartIndex == parts.Length)
            return (true, value);
        var pathSegment = parts[pathPartIndex];
        if (pathSegment == "*" && value is JsonArray jsonArray)
        {
            var output = new JsonArray();
            foreach (var item in jsonArray)
            {
                var resolvedValue = Parts(item, parts, pathPartIndex + 1);
                if (resolvedValue.found)
                    output.Add(resolvedValue.value.Copy());
            }

            return (true, output);
        }

        if (value is JsonObject jsonObject && jsonObject.TryGetPropertyValue(pathSegment, out var jsonNode))
            return Parts(jsonNode, parts, pathPartIndex + 1);
        if (value is JsonArray indexedArray && int.TryParse(pathSegment, out var index) && index >= 0 && index < indexedArray.Count)
            return Parts(indexedArray[index], parts, pathPartIndex + 1);
        return (false, null);
    }

    static (bool found, JsonNode? value) Resolve(string path, Context context)
    {
        while (path.StartsWith("../"))
        {
            context = context.Parent ?? context;
            path = path[3..];
        }

        if (path == "@index")
            return (context.Index != null, JsonValue.Create(context.Index));
        if (path == "@first")
            return (true, JsonValue.Create(context.Index == 0));
        if (path == "@last")
            return (true, JsonValue.Create(context.Index != null && context.Index == context.Length - 1));
        var parts = Tokens(path);
        var current = parts[0] == "this";
        if (current)
            parts = parts[1..];
        var result = Parts(context.Value, parts);
        return !result.found && !current ? Parts(context.Root, parts) : result;
    }

    static string String(JsonNode? value) => value is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var text) ? text : value?.ToJsonString() ?? "";
    static string Expression(string expression, Context context)
    {
        var json = expression.StartsWith("json ");
        var length = expression.StartsWith("length ");
        var resolvedValue = Resolve(json ? expression[5..].Trim() : length ? expression[7..].Trim() : expression, context);
        if (json)
            return resolvedValue.value?.ToJsonString() ?? "null";
        if (length)
            return (resolvedValue.value is JsonArray jsonArray ? jsonArray.Count : resolvedValue.value is JsonObject jsonObject ? jsonObject.Count : resolvedValue.value is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var textValue) ? textValue.Length : 0).ToString();
        return resolvedValue.found ? String(resolvedValue.value) : "{{" + expression + "}}";
    }

    static string Nodes(List<Node> nodes, Context context, string type, ref int loops)
    {
        var output = new StringBuilder();
        foreach (var node in nodes)
        {
            if (node.Kind == "text")
                output.Append(node.Value);
            else if (node.Kind == "expression")
                output.Append(Expression(node.Value, context));
            else if (Resolve(node.Value, context).value is JsonArray array)
            {
                loops += array.Count;
                if (loops > 500)
                    throw new ApiException(400, "A template may render at most 500 loop items.");
                for (int index = 0; index < array.Count; index++)
                {
                    if (index > 0 && type.Contains("json"))
                        output.Append(',');
                    output.Append(Nodes(node.Children!, new(array[index], context.Root, context, index, array.Count), type, ref loops));
                }
            }

            if (output.Length > 2_000_000)
                throw new ApiException(400, "Rendered response exceeds 2 MB.");
        }

        return output.ToString();
    }

    public static string Render(string template, string request, string requestType, string responseType, JsonObject? path = null, bool aliases = false)
    {
        if (template.Length > 200_000)
            throw new ApiException(400, "Response templates are limited to 200 KB.");
        var body = ParseBody(request, requestType);
        var root = body is JsonObject jsonObject ? (JsonObject)jsonObject.DeepClone() : new JsonObject();
        path ??= new();
        foreach (var property in path)
            root[property.Key] = property.Value.Copy();
        if (aliases)
            Aliases(body, root);
        root["request"] = new JsonObject
        {
            ["body"] = body.Copy(),
            ["pathParams"] = path.Copy()
        };
        int loops = 0;
        return Nodes(Compile(template), new(root, root), responseType, ref loops);
    }

    static void Aliases(JsonNode? value, JsonObject root, int depth = 0)
    {
        if (depth > 100)
            return;
        if (value is JsonObject jsonObject)
            foreach (var property in jsonObject)
            {
                if (property.Key.StartsWith("@_"))
                    continue;
                if (!root.ContainsKey(property.Key))
                    root[property.Key] = property.Value.Copy();
                Aliases(property.Value is JsonArray jsonArray ? jsonArray.FirstOrDefault() : property.Value, root, depth + 1);
            }
    }

    public static string? Match(JsonNode? expected, JsonNode? actual, bool exact, string path = "body", int depth = 0)
    {
        if (depth > 100)
            return "Body nesting exceeds 100 levels.";
        if (exact)
            return JsonNode.DeepEquals(expected, actual) ? null : path + " does not match the expected value.";
        if (expected is JsonObject expectedObject)
        {
            if (actual is not JsonObject actualObject)
                return path + " must be an object.";
            foreach (var property in expectedObject)
            {
                if (!actualObject.ContainsKey(property.Key))
                    return path + "." + property.Key + " is required.";
                var error = Match(property.Value, actualObject[property.Key], false, path + "." + property.Key, depth + 1);
                if (error != null)
                    return error;
            }

            return null;
        }

        if (expected is JsonArray expectedArray)
        {
            if (actual is not JsonArray actualArray)
                return path + " must be an array.";
            if (expectedArray.Count > 0)
                foreach (var item in actualArray)
                {
                    var error = Match(expectedArray[0], item, false, path + "[]", depth + 1);
                    if (error != null)
                        return error;
                }

            return null;
        }

        return expected?.GetValueKind() == actual?.GetValueKind() ? null : path + " has the wrong type.";
    }
}
