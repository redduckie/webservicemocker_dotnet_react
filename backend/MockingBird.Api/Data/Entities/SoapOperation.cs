namespace MockingBird.Data.Entities;

public class SoapOperation
{
    public string Kind { get; set; } = "soap";
    public string ProjectId { get; set; } = "";
    public string Name { get; set; } = "";
    public int Position { get; set; }
    public string? SoapAction { get; set; }
    public string? RequestXml { get; set; }
    public string? ResponseXml { get; set; }
    public bool? Customized { get; set; }
    public MockProject Project { get; set; } = null!;
}
