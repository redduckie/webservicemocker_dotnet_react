using MockingBird.Common;
using Microsoft.AspNetCore.Antiforgery;
using System.Text.Json;

namespace MockingBird.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext httpContext)
    {
        try
        {
            await next(httpContext);
        }
        catch (Exception exception) when (!httpContext.Response.HasStarted)
        {
            var status = exception is ApiException ae ? ae.Status : exception is AntiforgeryValidationException ? 403 : exception is JsonException or InvalidOperationException or FormatException ? 400 : exception is BadHttpRequestException be ? be.StatusCode : 500;
            var message = exception is ApiException ? exception.Message : exception is AntiforgeryValidationException ? "Refresh the page and retry (invalid CSRF token)." : status == 400 ? "Invalid request data." : "The request failed. Check the API logs.";
            if (status >= 500)
                logger.LogError(exception, "API request failed: {Path}", httpContext.Request.Path);
            httpContext.Response.StatusCode = status;
            await httpContext.Response.WriteAsJsonAsync(new { error = message });
        }
    }
}
