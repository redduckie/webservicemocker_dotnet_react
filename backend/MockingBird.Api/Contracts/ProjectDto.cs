namespace MockingBird.Contracts;

public record ProjectDto(string Id, string Name, string CreatedAt, string SessionToken, bool Enabled, string? MockUrl, string? MockBaseUrl, string? WsdlContent, List<EndpointDto> Endpoints, List<OperationDto> Operations);
