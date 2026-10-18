using MockingBird.Contracts;
using MockingBird.Common;
using MockingBird.Services;
using static MockingBird.Endpoints.RequestBodyReader;

namespace MockingBird.Endpoints;

public static class CollectionEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/tester/collections", async (HttpContext httpContext, IdentityService identity, CollectionService collections) => Results.Ok(await collections.List((await identity.Require(httpContext, "requestCollections")).Email)));
        app.MapPost("/api/tester/collections", async (HttpContext httpContext, IdentityService identity, CollectionService collections) => Results.Json(await collections.Save((await identity.Require(httpContext, "requestCollections")).Email, ApplicationValues.Id(), await ReadAsync<CollectionDto>(httpContext), true), statusCode: 201));
        app.MapGet("/api/tester/collections/{id}", async (string id, HttpContext httpContext, IdentityService identity, CollectionService collections) => Results.Ok(await collections.Get((await identity.Require(httpContext, "requestCollections")).Email, id) ?? throw new ApiException(404, "Collection not found.")));
        app.MapMethods("/api/tester/collections/{id}", ["PUT", "PATCH"], async (string id, HttpContext httpContext, IdentityService identity, CollectionService collections) => Results.Ok(await collections.Save((await identity.Require(httpContext, "requestCollections")).Email, id, await ReadAsync<CollectionDto>(httpContext), delta: httpContext.Request.Method == "PATCH")));
        app.MapDelete("/api/tester/collections/{id}", async (string id, HttpContext httpContext, IdentityService identity, CollectionService collections) =>
        {
            await collections.Delete((await identity.Require(httpContext, "requestCollections")).Email, id, httpContext.Request.Headers.IfMatch.ToString());
            return Results.NoContent();
        });
    }
}
