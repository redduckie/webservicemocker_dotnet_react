namespace MockingBird.Data.Entities;

public class UserFeature
{
    public Guid UserId { get; set; }
    public string Feature { get; set; } = "";
    public bool Enabled { get; set; }
    public AccessUser User { get; set; } = null!;
}
