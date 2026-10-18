namespace MockingBird.Data.Entities;

public class RequestLog
{
    public string Kind { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Id { get; set; } = "";
    public DateTimeOffset RecordedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public MockingBird.Contracts.LogDto Data { get; set; } = null!;
    public MockProject Project { get; set; } = null!;
}
