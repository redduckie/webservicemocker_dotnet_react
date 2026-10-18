namespace MockingBird.Contracts;

public record RestProjectFile(string Format, int Version, string Name, List<EndpointDto> Endpoints);
