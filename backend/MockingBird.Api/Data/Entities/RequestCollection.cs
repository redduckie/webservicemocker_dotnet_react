namespace MockingBird.Data.Entities;

public class RequestCollection
{
    public Guid Owner { get; set; }
    public string Id { get; set; } = "";
    public string Revision { get; set; } = "";
    public string? NameEncrypted { get; set; }
    public string? Mode { get; set; }
    public string? UpdatedAt { get; set; }
    public int? RequestCount { get; set; }
    public bool VariablesPresent { get; set; }
    public bool SensitivePresent { get; set; }
    public AccessUser User { get; set; } = null!;
    public List<CollectionRequest> Requests { get; set; } = [];
    public List<CollectionVariable> Variables { get; set; } = [];
    public List<CollectionSensitiveVariable> SensitiveVariables { get; set; } = [];
}
