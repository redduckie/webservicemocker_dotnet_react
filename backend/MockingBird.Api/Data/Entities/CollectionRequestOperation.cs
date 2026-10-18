namespace MockingBird.Data.Entities;

public class CollectionRequestOperation
{
    public Guid Owner { get; set; }
    public string CollectionId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public int Position { get; set; }
    public string NameEncrypted { get; set; } = "";
    public string SoapActionEncrypted { get; set; } = "";
    public string? RequestXmlEncrypted { get; set; }
    public CollectionRequest Request { get; set; } = null!;
}
