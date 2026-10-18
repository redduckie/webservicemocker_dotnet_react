using MockingBird.Services;
using Microsoft.AspNetCore.Antiforgery;

namespace MockingBird.Middleware;

public sealed class AntiforgeryMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        var isMockRequest = request.Path.StartsWithSegments("/api/rest-mock")
            || request.Path.StartsWithSegments("/api/mock");
        var isSafeMethod = HttpMethods.IsGet(request.Method)
            || HttpMethods.IsHead(request.Method)
            || HttpMethods.IsOptions(request.Method);
        var requiresValidation = request.Path.StartsWithSegments("/api")
            && !isSafeMethod
            && IdentityService.ExplicitKey(request) == null
            && (!isMockRequest || context.User.Identity?.IsAuthenticated == true);

        if (requiresValidation)
        {
            await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
        }

        await next(context);
    }
}
