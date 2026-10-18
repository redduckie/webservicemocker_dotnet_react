namespace MockingBird.Data.Entities;

public class AccessUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string Status { get; set; } = "pending";
    public string? ApiKey { get; set; }
    public string? CredentialKey { get; set; }
    public string? DisplayName { get; set; }
    public string Role { get; set; } = "user";
    public string RequestedAt { get; set; } = "";
    public string? ReviewedAt { get; set; }
    public bool HasFeatures { get; set; }
    public string EncryptionScope { get; set; } = "";
    public List<UserFeature> Features { get; set; } = [];
    public List<MockProject> Projects { get; set; } = [];
    public List<RequestCollection> Collections { get; set; } = [];
}
