namespace MockingBird.Contracts;

public record LogDto(string Id, string ProjectId, string? Timestamp, string? OperationName, string? EndpointId, string? Method, string? Path, Dictionary<string, string> RequestHeaders, string RequestBody, long RequestBodySizeBytes, bool RequestBodyTruncated, string ResponseBody, bool Matched, int? StatusCode);
