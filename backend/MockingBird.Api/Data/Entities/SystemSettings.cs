namespace MockingBird.Data.Entities;

public class SystemSettings
{
    public bool Id { get; set; } = true;
    public int? LogRetentionDays { get; set; } = 2;
    public int? MaxLogsPerProject { get; set; } = 50;
    public int? MaxLoggedRequestBodyMb { get; set; } = 3;
    public bool? ExternalRequestsEnabled { get; set; } = false;
}
