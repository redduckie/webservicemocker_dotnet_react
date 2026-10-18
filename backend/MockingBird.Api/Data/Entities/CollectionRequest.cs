namespace MockingBird.Data.Entities;

public class CollectionRequest
{
    public Guid Owner { get; set; }
    public string CollectionId { get; set; } = "";
    public string Id { get; set; } = "";
    public int Position { get; set; }
    public string? Mode { get; set; }
    public string? Method { get; set; }
    public string? AuthType { get; set; }
    public string? NameEncrypted { get; set; }
    public string? UrlEncrypted { get; set; }
    public string? BodyEncrypted { get; set; }
    public string? TokenEncrypted { get; set; }
    public string? UsernameEncrypted { get; set; }
    public string? PasswordEncrypted { get; set; }
    public string? ApiKeyNameEncrypted { get; set; }
    public string? WsdlUrlEncrypted { get; set; }
    public string? WsdlNameEncrypted { get; set; }
    public string? SelectedOperationEncrypted { get; set; }
    public string? PreRequestScriptEncrypted { get; set; }
    public string? PostResponseScriptEncrypted { get; set; }
    public bool HeadersPresent { get; set; }
    public bool OperationsPresent { get; set; }
    public RequestCollection Collection { get; set; } = null!;
    public List<CollectionRequestHeader> Headers { get; set; } = [];
    public List<CollectionRequestOperation> Operations { get; set; } = [];
}
