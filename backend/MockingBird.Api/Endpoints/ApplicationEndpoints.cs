using Microsoft.EntityFrameworkCore;
using MockingBird.Data;
using MockingBird.Common;
using MockingBird.Services;

namespace MockingBird.Endpoints;

public static class ApplicationEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok", backend = "ASP.NET Core", storage = "EF Core / PostgreSQL" }));
        app.MapPost("/api/access/request", async (HttpContext httpContext, IdentityService identity, MockingBirdDbContext database) =>
        {
            var user = await identity.Current(httpContext, false) ?? throw new ApiException(401, "Sign in first.");
            if (user.Status != "approved")
                await database.Users.Where(candidateUser => candidateUser.Email == user.Email).ExecuteUpdateAsync(propertySetters => propertySetters.SetProperty(candidateUser => candidateUser.Status, "pending").SetProperty(candidateUser => candidateUser.RequestedAt, ApplicationValues.Now()));
            return Results.Ok(new { success = true });
        });
        app.MapGet("/api/bootstrap", async (HttpContext httpContext, IdentityService identity, ProjectService projects) =>
        {
            var user = await identity.Require(httpContext);
            var features = user.Permissions(identity.Admin(user));
            return Results.Ok(new { apiKey = user.CredentialKey, testerCapability = "cookie-csrf", features, projects = features.SoapMock ? await projects.List("soap", user.Id) : [], restProjects = features.RestMock ? await projects.List("rest", user.Id) : [] });
        });
    }
}
