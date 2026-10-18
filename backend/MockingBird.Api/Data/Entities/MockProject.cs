namespace MockingBird.Data.Entities;

public class MockProject
{
    public string Kind { get; set; } = "rest";
    public string Id { get; set; } = "";
    public Guid Owner { get; set; }
    public bool Enabled { get; set; }
    public string? Name { get; set; }
    public string? CreatedAt { get; set; }
    public string? MockUrl { get; set; }
    public string? MockBaseUrl { get; set; }
    public string? WsdlContent { get; set; }
    public AccessUser User { get; set; } = null!;
    public List<RestEndpoint> Endpoints { get; set; } = [];
    public List<SoapOperation> Operations { get; set; } = [];
    public List<RequestLog> Logs { get; set; } = [];
}
