namespace MockingBird.Contracts;

public class CollectionDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Mode { get; set; } = "rest";
    public string Revision { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public int RequestCount { get; set; }
    public List<RequestDraft> Requests { get; set; } = [];
    public Dictionary<string, string> Variables { get; set; } = [];
    public List<string> SensitiveVariables { get; set; } = [];
    public List<string>? Order { get; set; }
}
