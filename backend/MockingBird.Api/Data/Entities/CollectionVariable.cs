namespace MockingBird.Data.Entities;

public class CollectionVariable
{
    public Guid Owner { get; set; }
    public string CollectionId { get; set; } = "";
    public int Position { get; set; }
    public string NameEncrypted { get; set; } = "";
    public string ValueEncrypted { get; set; } = "";
    public RequestCollection Collection { get; set; } = null!;
}
