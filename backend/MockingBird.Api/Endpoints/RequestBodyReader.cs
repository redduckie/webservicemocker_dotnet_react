using MockingBird.Common;

namespace MockingBird.Endpoints;

public static class RequestBodyReader
{
    public static async Task<T> ReadAsync<T>(HttpContext context) where T : class
    {
        return await context.Request.ReadFromJsonAsync<T>()
            ?? throw new ApiException(400, "A request body is required.");
    }
}
