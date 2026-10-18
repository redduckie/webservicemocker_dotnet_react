namespace MockingBird.Endpoints;

public static class FrontendEndpoints
{
    public static void Map(WebApplication app)
    {
        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.MapFallback(async httpContext =>
        {
            if (httpContext.Request.Path.StartsWithSegments("/api"))
            {
                httpContext.Response.StatusCode = 404;
                await httpContext.Response.WriteAsJsonAsync(new { error = "API route not found." });
                return;
            }

            var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
            if (File.Exists(index))
            {
                httpContext.Response.ContentType = "text/html";
                await httpContext.Response.SendFileAsync(index);
            }
            else
            {
                httpContext.Response.StatusCode = 404;
                await httpContext.Response.WriteAsync("Run the React development server on http://localhost:5173, or publish the frontend into wwwroot.");
            }
        });
    }
}
