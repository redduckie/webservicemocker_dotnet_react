namespace MockingBird.Contracts;

public record FeatureAccess(bool SoapMock = true, bool RestMock = true, bool RequestCollections = true);
