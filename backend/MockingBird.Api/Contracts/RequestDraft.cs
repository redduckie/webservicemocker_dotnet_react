namespace MockingBird.Contracts;

public class RequestDraft
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Mode { get; set; } = "rest";
    public string Url { get; set; } = "";
    public string Method { get; set; } = "GET";
    public List<HeaderDto> Headers { get; set; } = [];
    public string Body { get; set; } = "";
    public string AuthType { get; set; } = "none";
    public string Token { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string ApiKeyName { get; set; } = "";
    public string WsdlUrl { get; set; } = "";
    public string WsdlName { get; set; } = "";
    public List<OperationDto> Operations { get; set; } = [];
    public string SelectedOperation { get; set; } = "";
    public string? PreRequestScript { get; set; }
    public string? PostResponseScript { get; set; }
}
