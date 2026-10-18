namespace MockingBird.Contracts;

public record SettingsDto(int LogRetentionDays = 2, int MaxLogsPerProject = 50, int MaxLoggedRequestBodyMb = 3, bool ExternalRequestsEnabled = false);
