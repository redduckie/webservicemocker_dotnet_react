namespace MockingBird.Middleware;

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext httpContext)
    {
        httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";
        httpContext.Response.Headers["Referrer-Policy"] = "same-origin";
        if (httpContext.Request.Path.StartsWithSegments("/api"))
            httpContext.Response.Headers.CacheControl = "private, no-store";
        await next(httpContext);
    }
}
