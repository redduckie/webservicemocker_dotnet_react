namespace MockingBird.Contracts;

public class EndpointDto
{
    public string Id { get; set; } = "";
    public string Method { get; set; } = "GET";
    public string Path { get; set; } = "/";
    public string Description { get; set; } = "";
    public string RequestBodyExample { get; set; } = "";
    public string ResponseBody { get; set; } = "{}";
    public int StatusCode { get; set; } = 200;
    public Dictionary<string, string> ResponseHeaders { get; set; } = [];
    public bool AuthenticationRequired { get; set; } = true;
    public bool RequireExactRequestValues { get; set; }
    public string RequestContentType { get; set; } = "application/json";
    public string ResponseContentType { get; set; } = "application/json";
}
