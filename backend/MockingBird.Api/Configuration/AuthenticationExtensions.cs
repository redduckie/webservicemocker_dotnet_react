using MockingBird.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;
using System.Text.Json;

namespace MockingBird.Configuration;

public static class AuthenticationExtensions
{
    public static WebApplicationBuilder AddApiAuthentication(this WebApplicationBuilder builder)
    {
        builder.Services.AddAntiforgery(antiforgeryOptions =>
        {
            antiforgeryOptions.HeaderName = "X-CSRF-TOKEN";
            antiforgeryOptions.Cookie.Name = "mockingbird.csrf";
            antiforgeryOptions.Cookie.SameSite = SameSiteMode.Strict;
        });
        var auth = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(cookieOptions =>
        {
            cookieOptions.Cookie.Name = "mockingbird.session";
            cookieOptions.Cookie.HttpOnly = true;
            cookieOptions.Cookie.SameSite = SameSiteMode.Lax;
            cookieOptions.ExpireTimeSpan = TimeSpan.FromDays(7);
            cookieOptions.Events.OnRedirectToLogin = redirectContext =>
            {
                redirectContext.Response.StatusCode = 401;
                return Task.CompletedTask;
            };
            cookieOptions.Events.OnRedirectToAccessDenied = redirectContext =>
            {
                redirectContext.Response.StatusCode = 403;
                return Task.CompletedTask;
            };
        });
        var googleId = builder.Configuration["Authentication:Google:ClientId"];
        var googleSecret = builder.Configuration["Authentication:Google:ClientSecret"];
        if (!string.IsNullOrEmpty(googleId) && !string.IsNullOrEmpty(googleSecret))
            auth.AddGoogle(googleOptions =>
            {
                googleOptions.ClientId = googleId;
                googleOptions.ClientSecret = googleSecret;
                googleOptions.CallbackPath = "/signin-google";
                googleOptions.Events.OnCreatingTicket = async ticketContext =>
                {
                    var email = ticketContext.Principal?.FindFirstValue(ClaimTypes.Email);
                    if (string.IsNullOrEmpty(email) || !ticketContext.User.TryGetProperty("verified_email", out var verified) || verified.ValueKind != JsonValueKind.True)
                        throw new InvalidOperationException("Google must provide a verified email address.");
                    await ticketContext.HttpContext.RequestServices.GetRequiredService<IdentityService>().GoogleUser(email, ticketContext.Principal!.FindFirstValue(ClaimTypes.Name) ?? email);
                };
                googleOptions.Events.OnRemoteFailure = failureContext =>
                {
                    failureContext.HandleResponse();
                    failureContext.Response.Redirect("/login?error=google");
                    return Task.CompletedTask;
                };
            });
        builder.Services.AddAuthorization();
        return builder;
    }
}
