namespace MockingBird.Data.Entities;

public class CollectionRequestHeader
{
    public Guid Owner { get; set; }
    public string CollectionId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public int Position { get; set; }
    public int? HeaderId { get; set; }
    public string NameEncrypted { get; set; } = "";
    public string ValueEncrypted { get; set; } = "";
    public CollectionRequest Request { get; set; } = null!;
}
