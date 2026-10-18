namespace MockingBird.Contracts;

public record OperationDto(string Name, string SoapAction, string? RequestXml, string ResponseXml = "", bool Customized = false);
