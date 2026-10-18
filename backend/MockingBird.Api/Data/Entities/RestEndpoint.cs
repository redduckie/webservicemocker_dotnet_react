namespace MockingBird.Data.Entities;

public class RestEndpoint
{
    public string Kind { get; set; } = "rest";
    public string ProjectId { get; set; } = "";
    public string Id { get; set; } = "";
    public int Position { get; set; }
    public string? Method { get; set; }
    public string? Path { get; set; }
    public string? Description { get; set; }
    public string? RequestBodyExample { get; set; }
    public string? ResponseBody { get; set; }
    public int? StatusCode { get; set; }
    public bool? AuthenticationRequired { get; set; }
    public bool? RequireExactRequestValues { get; set; }
    public string? RequestContentType { get; set; }
    public string? ResponseContentType { get; set; }
    public bool HeadersPresent { get; set; }
    public MockProject Project { get; set; } = null!;
    public List<EndpointResponseHeader> ResponseHeaders { get; set; } = [];
}
