namespace MockingBird.Data.Entities;

public class CollectionSensitiveVariable
{
    public Guid Owner { get; set; }
    public string CollectionId { get; set; } = "";
    public int Position { get; set; }
    public string NameEncrypted { get; set; } = "";
    public RequestCollection Collection { get; set; } = null!;
}
