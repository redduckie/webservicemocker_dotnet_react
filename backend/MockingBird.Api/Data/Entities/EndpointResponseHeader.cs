namespace MockingBird.Data.Entities;

public class EndpointResponseHeader
{
    public string ProjectId { get; set; } = "";
    public string EndpointId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
    public RestEndpoint Endpoint { get; set; } = null!;
}
