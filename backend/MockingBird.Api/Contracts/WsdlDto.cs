namespace MockingBird.Contracts;

public record WsdlDto(string Name, string EndpointUrl, List<OperationDto> Operations);
