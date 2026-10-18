namespace MockingBird.Contracts;

public record UserDto(string Email, string DisplayName, string Role, string Status, string RequestedAt, string? ReviewedAt, FeatureAccess Features);
