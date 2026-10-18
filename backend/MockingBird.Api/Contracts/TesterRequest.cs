namespace MockingBird.Contracts;

public record TesterRequest(string Url, string Method = "GET", Dictionary<string, string>? Headers = null, string Body = "");
