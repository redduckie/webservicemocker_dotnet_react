namespace MockingBird.Common;

public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
