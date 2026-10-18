using MockingBird.Common;
using MockingBird.Infrastructure.Templating;
using MockingBird.Contracts;
using System.Xml.Linq;

namespace MockingBird.Infrastructure.Soap;

public static class Wsdl
{
    static readonly XNamespace Ws = "http://schemas.xmlsoap.org/wsdl/", Xs = "http://www.w3.org/2001/XMLSchema", Soap = "http://schemas.xmlsoap.org/soap/envelope/";
    static string Local(string? value) => (value ?? "").Split(':').Last();
    public static WsdlDto Parse(string text)
    {
        XDocument document;
        try
        {
            document = Template.Xml(text);
        }
        catch (System.Xml.XmlException)
        {
            throw new ApiException(400, "Upload a valid WSDL XML document.");
        }

        var root = document.Root;
        if (root?.Name != Ws + "definitions")
            throw new ApiException(400, "A WSDL 1.1 definitions document is required.");
        var service = root.Elements(Ws + "service").FirstOrDefault();
        var targetNamespace = (string?)root.Attribute("targetNamespace") ?? "urn:mockingbird";
        var name = (string?)service?.Attribute("name") ?? (string?)root.Attribute("name") ?? "SOAP Service";
        var operations = new List<OperationDto>();
        foreach (var operation in root.Elements(Ws + "portType").Elements(Ws + "operation"))
        {
            var operationName = (string?)operation.Attribute("name") ?? "Operation";
            if (operations.Any(candidateOperation => candidateOperation.Name == operationName))
                continue;
            var binding = root.Elements(Ws + "binding").Elements(Ws + "operation").FirstOrDefault(candidateElement => (string?)candidateElement.Attribute("name") == operationName);
            var action = (string?)binding?.Elements().FirstOrDefault(candidateElement => candidateElement.Name.LocalName == "operation")?.Attribute("soapAction") ?? "";
            operations.Add(new OperationDto(operationName, action, Envelope(Message(operation.Element(Ws + "input"), operationName)), Envelope(Message(operation.Element(Ws + "output"), operationName + "Response"))));
            if (operations.Count > 500)
                throw new ApiException(400, "WSDL files may contain at most 500 operations.");
        }

        if (operations.Count == 0)
            throw new ApiException(400, "No SOAP operations found in the WSDL.");
        return new(name, (string?)service?.Descendants().FirstOrDefault(candidateElement => candidateElement.Name.LocalName == "address")?.Attribute("location") ?? "", operations);
        XElement Message(XElement? direction, string fallback)
        {
            var messageName = Local((string?)direction?.Attribute("message"));
            var message = root.Elements(Ws + "message").FirstOrDefault(candidateElement => (string?)candidateElement.Attribute("name") == messageName);
            var parts = message?.Elements(Ws + "part").ToArray() ?? [];
            if (parts.Length == 1 && parts[0].Attribute("element") is XAttribute partElementAttribute)
            {
                var declaration = Find(parts[0], partElementAttribute.Value, "element");
                if (declaration != null)
                    return Sample(declaration, 0, new HashSet<XElement>());
            }

            var wrapper = new XElement(XName.Get(fallback, targetNamespace));
            foreach (var part in parts)
            {
                var declaration = part.Attribute("element") is XAttribute attribute ? Find(part, attribute.Value, "element") : null;
                if (declaration != null)
                    wrapper.Add(Sample(declaration, 0, new HashSet<XElement>()));
                else
                    wrapper.Add(new XElement(XName.Get((string?)part.Attribute("name") ?? "value", targetNamespace), Primitive(Local((string?)part.Attribute("type")))));
            }

            return wrapper;
        }

        XElement? Find(XElement context, string qname, string kind)
        {
            var split = qname.Split(':');
            var target = split.Length > 1 ? context.GetNamespaceOfPrefix(split[0])?.NamespaceName : context.GetDefaultNamespace().NamespaceName;
            return root.Descendants(Xs + "schema").Where(candidateElement => string.IsNullOrEmpty(target) || (string?)candidateElement.Attribute("targetNamespace") == target).Elements(Xs + kind).FirstOrDefault(candidateElement => (string?)candidateElement.Attribute("name") == Local(qname)) ?? root.Descendants(Xs + kind).FirstOrDefault(candidateElement => (string?)candidateElement.Attribute("name") == Local(qname));
        }

        XElement Sample(XElement declaration, int depth, HashSet<XElement> seen)
        {
            var refName = (string?)declaration.Attribute("ref");
            if (refName != null)
            {
                var resolved = Find(declaration, refName, "element");
                if (resolved != null)
                    declaration = resolved;
            }

            var schema = declaration.Ancestors(Xs + "schema").FirstOrDefault();
            var qualified = declaration.Parent?.Name == Xs + "schema" || (string?)declaration.Attribute("form") == "qualified" || (string?)schema?.Attribute("elementFormDefault") == "qualified";
            var element = new XElement(XName.Get((string?)declaration.Attribute("name") ?? Local(refName) ?? "value", qualified ? (string?)schema?.Attribute("targetNamespace") ?? targetNamespace : ""));
            if (depth >= 12 || !seen.Add(declaration))
            {
                element.Value = "?";
                return element;
            }

            var typeName = (string?)declaration.Attribute("type");
            var complex = declaration.Element(Xs + "complexType") ?? (typeName != null ? Find(declaration, typeName, "complexType") : null);
            var simple = declaration.Element(Xs + "simpleType") ?? (typeName != null ? Find(declaration, typeName, "simpleType") : null);
            if (complex != null)
            {
                Fill(complex, element, depth, seen);
            }
            else
                element.Value = (string?)simple?.Descendants(Xs + "enumeration").FirstOrDefault()?.Attribute("value") ?? Primitive(Local(typeName ?? (string?)simple?.Descendants(Xs + "restriction").FirstOrDefault()?.Attribute("base")));
            seen.Remove(declaration);
            return element;
        }

        void Fill(XElement complex, XElement element, int depth, HashSet<XElement> seen)
        {
            if (depth > 12)
                return;
            foreach (var child in complex.Elements())
            {
                if (child.Name == Xs + "element")
                    element.Add(Sample(child, depth + 1, seen));
                else if (child.Name == Xs + "attribute")
                {
                    var attributeName = (string?)child.Attribute("name");
                    if (attributeName != null)
                        element.SetAttributeValue(attributeName, Primitive(Local((string?)child.Attribute("type"))));
                }
                else if (child.Name == Xs + "choice")
                {
                    var first = child.Elements().FirstOrDefault();
                    if (first != null)
                    {
                        var holder = new XElement(Xs + "sequence", new XElement(first));
                        Fill(holder, element, depth + 1, seen);
                    }
                }
                else if (child.Name == Xs + "extension")
                {
                    var baseType = Find(child, (string?)child.Attribute("base") ?? "", "complexType");
                    if (baseType != null && seen.Add(baseType))
                    {
                        Fill(baseType, element, depth + 1, seen);
                        seen.Remove(baseType);
                    }

                    Fill(child, element, depth + 1, seen);
                }
                else if (child.Name.Namespace == Xs && child.Name.LocalName is "sequence" or "all" or "complexContent" or "simpleContent")
                    Fill(child, element, depth + 1, seen);
            }
        }
    }

    static string Primitive(string type) => type switch
    {
        "boolean" => "false",
        "byte" or "short" or "int" or "integer" or "long" or "decimal" or "double" or "float" or "unsignedInt" or "positiveInteger" => "0",
        "date" => "2026-01-01",
        "dateTime" => "2026-01-01T00:00:00Z",
        _ => "?"
    };
    static string Envelope(XElement content) => new XDocument(new XDeclaration("1.0", "utf-8", null), new XElement(Soap + "Envelope", new XAttribute(XNamespace.Xmlns + "soap", Soap), new XElement(Soap + "Body", content))).ToString();
}
