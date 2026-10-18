using MockingBird.Common;
using MockingBird.Data.Entities;
using MockingBird.Infrastructure.Http;
using MockingBird.Infrastructure.Templating;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security;
using Microsoft.EntityFrameworkCore;
using MockingBird.Data;

namespace MockingBird.Services;

public class MockService(MockingBirdDbContext database, IdentityService identity, ProjectService projects, SettingsService settings)
{
    public static JsonObject? PathParams(string path, string pattern)
    {
        var pathSegments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var patternSegments = pattern.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (pathSegments.Length != patternSegments.Length)
            return null;
        var result = new JsonObject();
        for (int index = 0; index < pathSegments.Length; index++)
        {
            if (patternSegments[index].StartsWith(':'))
                result[patternSegments[index][1..]] = Uri.UnescapeDataString(pathSegments[index]);
            else if (!pathSegments[index].Equals(patternSegments[index], StringComparison.OrdinalIgnoreCase))
                return null;
        }

        return result;
    }

    public async Task<IResult> Rest(HttpContext httpContext, string id, string? path)
    {
        var project = await projects.Get("rest", id) ?? throw new ApiException(404, "Project not found.");
        var actual = "/" + (path ?? "");
        var endpoint = project.Endpoints.FirstOrDefault(candidateEndpoint => candidateEndpoint.Method == httpContext.Request.Method && PathParams(actual, candidateEndpoint.Path) != null);
        if (endpoint?.AuthenticationRequired != false)
        {
            var user = await identity.Require(httpContext, "restMock");
            if (project.SessionToken != user.Email)
                throw new ApiException(404, "Project not found.");
        }

        if (!project.Enabled)
            throw new ApiException(503, "This mock service is currently paused.");
        var body = Encoding.UTF8.GetString(await SafeHttpClient.ReadBounded(httpContext.Request.Body, 4 * 1024 * 1024, httpContext.RequestAborted));
        var status = endpoint?.StatusCode ?? 404;
        var response = "";
        var content = endpoint?.ResponseContentType ?? "application/json";
        try
        {
            if (endpoint == null)
                response = "{\"error\":\"No matching endpoint found.\"}";
            else
            {
                var requestType = endpoint.RequestContentType;
                var incoming = httpContext.Request.ContentType?.Split(';')[0].Trim();
                if (body.Length > 0 && !string.IsNullOrEmpty(incoming) && incoming != requestType)
                    throw new ApiException(415, "Expected Content-Type " + requestType + ".");
                var parsed = Template.ParseBody(body, requestType);
                var sample = endpoint.RequestBodyExample;
                if (sample.Trim().Length > 0)
                {
                    if (string.IsNullOrWhiteSpace(body))
                        throw new ApiException(400, "A request body is required.");
                    var error = Template.Match(Template.ParseBody(sample, requestType), parsed, endpoint.RequireExactRequestValues);
                    if (error != null)
                        throw new ApiException(400, error);
                }

                response = Template.Render(endpoint.ResponseBody, body, requestType, content, PathParams(actual, endpoint.Path));
                foreach (var header in endpoint.ResponseHeaders)
                    if (!SafeHttpClient.HopHeaders.Contains(header.Key) && !header.Key.Equals("set-cookie", StringComparison.OrdinalIgnoreCase))
                        httpContext.Response.Headers[header.Key] = header.Value;
            }
        }
        catch (ApiException exception)
        {
            status = exception.Status;
            content = "application/json";
            response = JsonSerializer.Serialize(new { error = exception.Message });
        }

        await Log(httpContext, "rest", id, body, response, endpoint?.Id, null, httpContext.Request.Method, actual, status, endpoint != null);
        return Results.Text(response, content + "; charset=utf-8", Encoding.UTF8, status);
    }

    public static string Fault(string message) => "<?xml version=\"1.0\"?><soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><soap:Fault><faultcode>soap:Client</faultcode><faultstring>" + SecurityElement.Escape(message) + "</faultstring></soap:Fault></soap:Body></soap:Envelope>";
    public async Task<IResult> Soap(HttpContext httpContext, string id)
    {
        try
        {
            var user = await identity.Require(httpContext, "soapMock");
            var project = await projects.Owned("soap", id, user.Id);
            if (!project.Enabled)
                throw new ApiException(503, "This mock service is currently paused.");
            var body = Encoding.UTF8.GetString(await SafeHttpClient.ReadBounded(httpContext.Request.Body, 4 * 1024 * 1024, httpContext.RequestAborted));
            var action = httpContext.Request.Headers["SOAPAction"].ToString().Trim('"');
            var operation = project.Operations.FirstOrDefault(candidateOperation => candidateOperation.SoapAction == action);
            if (operation == null && !string.IsNullOrWhiteSpace(body))
            {
                try
                {
                    var name = Template.Xml(body).Descendants().FirstOrDefault(candidateElement => candidateElement.Name.LocalName == "Body")?.Elements().FirstOrDefault()?.Name.LocalName;
                    operation = project.Operations.FirstOrDefault(candidateOperation => candidateOperation.Name == name);
                }
                catch (System.Xml.XmlException)
                {
                }
            }

            var status = operation == null ? 500 : 200;
            string response;
            try
            {
                response = operation == null ? Fault("No matching operation found.") : Template.Render(operation.ResponseXml, body, "application/xml", "application/xml", aliases: true);
            }
            catch (ApiException exception)
            {
                status = 400;
                response = Fault(exception.Message);
            }

            await Log(httpContext, "soap", id, body, response, null, operation?.Name, null, null, null, operation != null);
            return Results.Text(response, "text/xml; charset=utf-8", Encoding.UTF8, status);
        }
        catch (ApiException exception)
        {
            return Results.Text(Fault(exception.Message), "text/xml; charset=utf-8", Encoding.UTF8, exception.Status);
        }
    }

    private async Task Log(HttpContext httpContext, string kind, string id, string body, string response, string? endpointId, string? operationName, string? method, string? path, int? statusCode, bool matched)
    {
        var logSettings = await settings.Get();
        var bytes = Encoding.UTF8.GetBytes(body);
        var size = bytes.Length;
        var maxLoggedBodyBytes = Math.Clamp(logSettings.MaxLoggedRequestBodyMb, 1, 4) * 1024 * 1024;
        var headers = new Dictionary<string, string>();
        foreach (var header in httpContext.Request.Headers)
        {
            var headerName = header.Key.ToLowerInvariant();
            headers[headerName] = headerName.Contains("authorization") || headerName.Contains("cookie") || headerName.Contains("api-key") || headerName.Contains("apikey") || headerName.StartsWith("x-mockingbird") || headerName.Contains("csrf") ? "[REDACTED]" : header.Value.ToString();
        }

        var log = new RequestLog
        {
            Id = ApplicationValues.Id(),
            Kind = kind,
            ProjectId = id,
            RecordedAt = DateTimeOffset.UtcNow
        };
        log.ExpiresAt = log.RecordedAt.AddDays(logSettings.LogRetentionDays);
        log.Data = new MockingBird.Contracts.LogDto(log.Id, id, ApplicationValues.Now(), operationName, endpointId, method, path, headers, size > maxLoggedBodyBytes ? Encoding.UTF8.GetString(bytes, 0, maxLoggedBodyBytes) : body, size, size > maxLoggedBodyBytes, response, matched, statusCode);
        await using var transaction = await database.Database.BeginTransactionAsync();
        var exists = await database.Projects.FromSqlInterpolated($"SELECT * FROM mockingbird.projects WHERE kind={kind} AND id={id} FOR UPDATE").AsNoTracking().ToListAsync();
        if (exists.Count == 0)
            return;
        await database.Logs.Where(candidateRequestLog => candidateRequestLog.ExpiresAt <= DateTimeOffset.UtcNow).ExecuteDeleteAsync();
        database.Logs.Add(log);
        await database.SaveChangesAsync();
        var cutoff = DateTimeOffset.UtcNow.AddDays(-logSettings.LogRetentionDays);
        var excessLogIds = database.Logs.Where(candidateRequestLog => candidateRequestLog.Kind == kind && candidateRequestLog.ProjectId == id).OrderByDescending(candidateRequestLog => candidateRequestLog.RecordedAt).ThenBy(candidateRequestLog => candidateRequestLog.Id).Skip(logSettings.MaxLogsPerProject).Select(candidateRequestLog => candidateRequestLog.Id);
        await database.Logs.Where(candidateRequestLog => candidateRequestLog.Kind == kind && candidateRequestLog.ProjectId == id && (candidateRequestLog.RecordedAt <= cutoff || excessLogIds.Contains(candidateRequestLog.Id))).ExecuteDeleteAsync();
        await transaction.CommitAsync();
    }
}
