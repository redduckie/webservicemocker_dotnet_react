namespace MockingBird.Contracts;

public record TesterResponse(int Status, string StatusText, Dictionary<string, string> Headers, string Body, long DurationMs, int SizeBytes);
