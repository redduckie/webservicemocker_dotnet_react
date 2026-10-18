namespace MockingBird.Contracts;

public record UserUpdate(string? Status, FeatureAccess? Features, bool RotateKey = false);
