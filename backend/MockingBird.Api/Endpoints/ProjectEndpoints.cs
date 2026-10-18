using MockingBird.Common;
using MockingBird.Services;
using Microsoft.EntityFrameworkCore;
using MockingBird.Contracts;
using MockingBird.Data;

namespace MockingBird.Endpoints;

public static class ProjectEndpoints
{
    public static void Map(WebApplication app, string kind)
    {
        var route = kind == "rest" ? "/api/rest-projects" : "/api/projects";
        var feature = kind == "rest" ? "restMock" : "soapMock";
        app.MapGet(route, async (HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Ok(await projects.List(kind, (await identity.Require(httpContext, feature)).Id)));
        if (kind == "rest")
            app.MapPost(route, async (HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Json(await projects.Create(kind, (await RequestBodyReader.ReadAsync<ProjectUpdate>(httpContext)).Name ?? "", (await identity.Require(httpContext, feature)).Id), statusCode: 201));
        app.MapGet(route + "/{id}", async (string id, HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Ok(await projects.Owned(kind, id, (await identity.Require(httpContext, feature)).Id)));
        app.MapPatch(route + "/{id}", async (string id, HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Ok(await projects.Update(kind, id, (await identity.Require(httpContext, feature)).Id, await RequestBodyReader.ReadAsync<ProjectUpdate>(httpContext))));
        app.MapDelete(route + "/{id}", async (string id, HttpContext httpContext, IdentityService identity, ProjectService projects) =>
        {
            await projects.Delete(kind, id, (await identity.Require(httpContext, feature)).Id);
            return Results.Ok(new { success = true });
        });
        app.MapGet(route + "/{id}/logs", async (string id, HttpContext httpContext, IdentityService identity, ProjectService projects, MockingBirdDbContext database) =>
        {
            await projects.Owned(kind, id, (await identity.Require(httpContext, feature)).Id);
            int.TryParse(httpContext.Request.Query["page"], out var page);
            int.TryParse(httpContext.Request.Query["pageSize"], out var size);
            page = Math.Max(1, page);
            size = Math.Clamp(size == 0 ? 20 : size, 1, 100);
            var query = database.Logs.AsNoTracking().Where(candidateRequestLog => candidateRequestLog.Kind == kind && candidateRequestLog.ProjectId == id && candidateRequestLog.ExpiresAt > DateTimeOffset.UtcNow);
            var total = await query.CountAsync();
            var rows = await query.OrderByDescending(candidateRequestLog => candidateRequestLog.RecordedAt).ThenBy(candidateRequestLog => candidateRequestLog.Id).Skip((page - 1) * size).Take(size).ToListAsync();
            return Results.Ok(new LogPage(rows.Select(candidateRequestLog => candidateRequestLog.Dto()).ToList(), total));
        });
        if (kind == "soap")
        {
            app.MapPut(route + "/{id}/operations/{name}", async (string id, string name, HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Ok(new { operation = await projects.UpdateOperation(id, name, (await identity.Require(httpContext, feature)).Id, await RequestBodyReader.ReadAsync<OperationDto>(httpContext)) }));
            return;
        }

        app.MapPost(route + "/{id}/endpoints", async (string id, HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Json(await projects.AddEndpoint(id, (await identity.Require(httpContext, feature)).Id, await RequestBodyReader.ReadAsync<EndpointDto>(httpContext)), statusCode: 201));
        app.MapPut(route + "/{id}/endpoints/{endpointId}", async (string id, string endpointId, HttpContext httpContext, IdentityService identity, ProjectService projects) => Results.Ok(await projects.UpdateEndpoint(id, endpointId, (await identity.Require(httpContext, feature)).Id, await RequestBodyReader.ReadAsync<EndpointDto>(httpContext))));
        app.MapDelete(route + "/{id}/endpoints/{endpointId}", async (string id, string endpointId, HttpContext httpContext, IdentityService identity, ProjectService projects) =>
        {
            await projects.DeleteEndpoint(id, endpointId, (await identity.Require(httpContext, feature)).Id);
            return Results.Ok(new { success = true });
        });
        app.MapPost(route + "/{id}/endpoints/{endpointId}/duplicate", async (string id, string endpointId, HttpContext httpContext, IdentityService identity, ProjectService projects) =>
        {
            var owner = (await identity.Require(httpContext, feature)).Id;
            var project = await projects.Owned(kind, id, owner);
            var endpoint = project.Endpoints.FirstOrDefault(candidateEndpoint => candidateEndpoint.Id == endpointId) ?? throw new ApiException(404, "Endpoint not found.");
            var original = endpoint.Path;
            var suffix = 1;
            do
            {
                endpoint.Path = original + "-copy" + (suffix == 1 ? "" : "-" + suffix);
                suffix++;
            }
            while (project.Endpoints.Any(candidateEndpoint => candidateEndpoint.Id != endpoint.Id && candidateEndpoint.Method == endpoint.Method && candidateEndpoint.Path == endpoint.Path));
            return Results.Json(await projects.AddEndpoint(id, owner, endpoint), statusCode: 201);
        });
        app.MapPost(route + "/import", async (HttpContext httpContext, IdentityService identity, ProjectService projects) =>
        {
            var owner = (await identity.Require(httpContext, feature)).Id;
            var input = await RequestBodyReader.ReadAsync<ProjectImport>(httpContext);
            var importedProject = input.Project;
            if (importedProject.Format != "mockingbird-rest-project" || importedProject.Version != 1 || importedProject.Endpoints.Count > 500)
                throw new ApiException(400, "Choose a MockingBird REST project file (version 1, at most 500 endpoints).");
            return Results.Json(await projects.Create(kind, input.Name, owner, endpoints: importedProject.Endpoints), statusCode: 201);
        });
    }
}
