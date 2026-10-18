using MockingBird.Common;
using MockingBird.Services;
using MockingBird.Infrastructure.Http;
using MockingBird.Infrastructure.Soap;
using System.Text;
using MockingBird.Contracts;

namespace MockingBird.Endpoints;

public static class MockEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapMethods("/api/rest-mock/{id}/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], (string id, string? path, HttpContext httpContext, MockService mocks) => mocks.Rest(httpContext, id, path));
        app.MapPost("/api/mock/{id}", (string id, HttpContext httpContext, MockService mocks) => mocks.Soap(httpContext, id));
        app.MapPost("/api/tester/request", async (HttpContext httpContext, IdentityService identity, SafeHttpClient http) =>
        {
            var user = await identity.Require(httpContext, "requestCollections");
            await http.Permit(user.Email);
            return Results.Ok(await http.Send(await RequestBodyReader.ReadAsync<TesterRequest>(httpContext), httpContext.RequestAborted));
        });
        app.MapPost("/api/tester/wsdl", async (HttpContext httpContext, IdentityService identity, SafeHttpClient http) =>
        {
            var user = await identity.Require(httpContext, "requestCollections");
            var (xml, _) = await ReadWsdl(httpContext, http, user.Email);
            return Results.Ok(Wsdl.Parse(xml));
        });
        app.MapPost("/api/wsdl/upload", async (HttpContext httpContext, IdentityService identity, SafeHttpClient http, ProjectService projects) =>
        {
            var user = await identity.Require(httpContext, "soapMock");
            var (xml, name) = await ReadWsdl(httpContext, http, user.Email);
            var parsed = Wsdl.Parse(xml);
            return Results.Json(await projects.Create("soap", string.IsNullOrWhiteSpace(name) ? parsed.Name : name, user.Id, xml, parsed.Operations), statusCode: 201);
        });
    }

    private static async Task<(string xml, string name)> ReadWsdl(HttpContext httpContext, SafeHttpClient http, string owner)
    {
        string url;
        var name = "";
        if (httpContext.Request.HasFormContentType)
        {
            var form = await httpContext.Request.ReadFormAsync(httpContext.RequestAborted);
            name = form["projectName"].ToString();
            var file = form.Files.GetFile("wsdl") ?? form.Files.GetFile("file");
            if (file != null && file.Length > 0)
            {
                await using var stream = file.OpenReadStream();
                return (Encoding.UTF8.GetString(await SafeHttpClient.ReadBounded(stream, 2 * 1024 * 1024, httpContext.RequestAborted)), name);
            }

            url = form["wsdlUrl"].ToString();
        }
        else
            url = (await RequestBodyReader.ReadAsync<WsdlUrl>(httpContext)).Url;
        if (string.IsNullOrWhiteSpace(url))
            throw new ApiException(400, "Select a WSDL file or enter a URL.");
        await http.Permit(owner);
        var response = await http.Send(new TesterRequest(url), httpContext.RequestAborted);
        if (response.Status is < 200 or > 299)
            throw new ApiException(400, "The WSDL URL did not return a successful response. Redirects are not followed.");
        return (response.Body, name);
    }
}
