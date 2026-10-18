using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using MockingBird.Contracts;
using MockingBird.Common;
using MockingBird.Services;
using static MockingBird.Endpoints.RequestBodyReader;

namespace MockingBird.Endpoints;

public static class AuthenticationEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/auth/csrf", (HttpContext httpContext, IAntiforgery csrf) => Results.Ok(new { token = csrf.GetAndStoreTokens(httpContext).RequestToken }));
        app.MapGet("/api/auth/me", async (HttpContext httpContext, IdentityService identity) =>
        {
            var user = await identity.Current(httpContext, false);
            return Results.Ok(user == null ? new AccountDto(false) : new AccountDto(true, user.DisplayName ?? user.Email, user.Email, identity.Admin(user), user.Status));
        });
        app.MapGet("/api/auth/google", (IConfiguration config) => string.IsNullOrEmpty(config["Authentication:Google:ClientId"]) ? Results.BadRequest(new { error = "Google OAuth is not configured. Use an existing API key to sign in." }) : Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }, [GoogleDefaults.AuthenticationScheme]));
        app.MapPost("/api/auth/key", async (HttpContext httpContext, IdentityService identity) =>
        {
            var keyLogin = await ReadAsync<KeyLogin>(httpContext);
            var user = await identity.ByKey(keyLogin.ApiKey) ?? throw new ApiException(401, "Invalid API key.");
            await IdentityService.SignIn(httpContext, user);
            return Results.Ok(new { success = true });
        });
        app.MapPost("/api/auth/logout", async (HttpContext httpContext) =>
        {
            await httpContext.SignOutAsync();
            return Results.NoContent();
        });
        app.MapPost("/api/auth/api-key", async (HttpContext httpContext, IdentityService identity) => Results.Ok(new { apiKey = (await identity.Require(httpContext)).CredentialKey }));
    }
}
