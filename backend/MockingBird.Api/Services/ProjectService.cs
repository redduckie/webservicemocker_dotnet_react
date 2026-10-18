using MockingBird.Common;
using MockingBird.Data.Entities;
using MockingBird.Infrastructure.Templating;
using Microsoft.EntityFrameworkCore;
using MockingBird.Contracts;
using MockingBird.Data;

namespace MockingBird.Services;

public class ProjectService(MockingBirdDbContext database)
{
    private IQueryable<MockProject> Query() => database.Projects.AsNoTracking().AsSplitQuery().Include(candidateProject => candidateProject.Endpoints).ThenInclude(candidateEndpoint => candidateEndpoint.ResponseHeaders).Include(candidateProject => candidateProject.Operations).Include(candidateProject => candidateProject.User);
    public async Task<List<ProjectDto>> List(string kind, Guid owner) => (await Query().Where(candidateProject => candidateProject.Kind == kind && candidateProject.Owner == owner).OrderBy(candidateProject => candidateProject.CreatedAt).ThenBy(candidateProject => candidateProject.Id).ToListAsync()).Select(candidateProject => candidateProject.Dto()).ToList();
    public async Task<ProjectDto?> Get(string kind, string id) => (await Query().SingleOrDefaultAsync(candidateProject => candidateProject.Kind == kind && candidateProject.Id == id))?.Dto();
    public async Task<ProjectDto> Owned(string kind, string id, Guid owner) => (await Query().SingleOrDefaultAsync(candidateProject => candidateProject.Kind == kind && candidateProject.Id == id && candidateProject.Owner == owner))?.Dto() ?? throw new ApiException(404, "Project not found.");
    public static string Name(string name)
    {
        name = name.Trim();
        if (name.Length is < 1 or > 120)
            throw new ApiException(400, "Project names must contain 1–120 characters.");
        return name;
    }

    public async Task<ProjectDto> Create(string kind, string name, Guid owner, string? wsdl = null, List<OperationDto>? operations = null, List<EndpointDto>? endpoints = null)
    {
        var id = ApplicationValues.Id();
        var project = new MockProject
        {
            Id = id,
            Kind = kind,
            Name = Name(name),
            Owner = owner,
            CreatedAt = ApplicationValues.Now(),
            Enabled = false,
            WsdlContent = wsdl,
            MockUrl = kind == "soap" ? "/api/mock/" + id : null,
            MockBaseUrl = kind == "rest" ? "/api/rest-mock/" + id : null
        };
        project.Operations = (operations ?? []).Select((candidateOperation, index) => new SoapOperation { ProjectId = id, Name = candidateOperation.Name, SoapAction = candidateOperation.SoapAction, RequestXml = candidateOperation.RequestXml, ResponseXml = candidateOperation.ResponseXml, Customized = candidateOperation.Customized, Position = index + 1 }).ToList();
        project.Endpoints = (endpoints ?? []).Select((candidateEndpoint, index) => Entity(Validate(candidateEndpoint), id, ApplicationValues.Id(), index + 1)).ToList();
        database.Projects.Add(project);
        await database.SaveChangesAsync();
        return await Owned(kind, id, owner);
    }

    public async Task<ProjectDto> Update(string kind, string id, Guid owner, ProjectUpdate changes)
    {
        var project = await database.Projects.SingleOrDefaultAsync(candidateProject => candidateProject.Kind == kind && candidateProject.Id == id && candidateProject.Owner == owner) ?? throw new ApiException(404, "Project not found.");
        if (changes.Name != null)
            project.Name = Name(changes.Name);
        if (changes.Enabled.HasValue)
            project.Enabled = changes.Enabled.Value;
        await database.SaveChangesAsync();
        return await Owned(kind, id, owner);
    }

    public async Task Delete(string kind, string id, Guid owner)
    {
        if (await database.Projects.Where(candidateProject => candidateProject.Kind == kind && candidateProject.Id == id && candidateProject.Owner == owner).ExecuteDeleteAsync() != 1)
            throw new ApiException(404, "Project not found.");
    }

    // Serialize edits per project so simultaneous endpoint additions retain deterministic positions.
    public async Task Lock(string kind, string id, Guid owner)
    {
        var rows = await database.Projects.FromSqlInterpolated($"SELECT * FROM mockingbird.projects WHERE kind={kind} AND id={id} AND owner={owner} FOR UPDATE").AsNoTracking().ToListAsync();
        if (rows.Count == 0)
            throw new ApiException(404, "Project not found.");
    }

    public async Task<EndpointDto> AddEndpoint(string id, Guid owner, EndpointDto input)
    {
        Validate(input);
        await using var transaction = await database.Database.BeginTransactionAsync();
        await Lock("rest", id, owner);
        var position = (await database.Endpoints.Where(candidateEndpoint => candidateEndpoint.ProjectId == id).MaxAsync(candidateEndpoint => (int?)candidateEndpoint.Position) ?? 0) + 1;
        var endpoint = Entity(input, id, ApplicationValues.Id(), position);
        database.Endpoints.Add(endpoint);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return endpoint.Dto();
    }

    public async Task<EndpointDto> UpdateEndpoint(string id, string endpointId, Guid owner, EndpointDto input)
    {
        Validate(input);
        await using var transaction = await database.Database.BeginTransactionAsync();
        await Lock("rest", id, owner);
        var endpoint = await database.Endpoints.SingleOrDefaultAsync(candidateEndpoint => candidateEndpoint.ProjectId == id && candidateEndpoint.Id == endpointId) ?? throw new ApiException(404, "Endpoint not found.");
        var replacement = Entity(input, id, endpointId, endpoint.Position);
        database.Entry(endpoint).CurrentValues.SetValues(replacement);
        await database.Set<EndpointResponseHeader>().Where(candidateHeader => candidateHeader.ProjectId == id && candidateHeader.EndpointId == endpointId).ExecuteDeleteAsync();
        endpoint.ResponseHeaders = replacement.ResponseHeaders;
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return endpoint.Dto();
    }

    public async Task DeleteEndpoint(string id, string endpointId, Guid owner)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        await Lock("rest", id, owner);
        if (await database.Endpoints.Where(candidateEndpoint => candidateEndpoint.ProjectId == id && candidateEndpoint.Id == endpointId).ExecuteDeleteAsync() != 1)
            throw new ApiException(404, "Endpoint not found.");
        await transaction.CommitAsync();
    }

    public async Task<OperationDto> UpdateOperation(string id, string previousName, Guid owner, OperationDto input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 150)
            throw new ApiException(400, "An operation name is required (at most 150 characters).");
        try
        {
            Template.Xml(Template.Render(input.ResponseXml, input.RequestXml ?? "", "application/xml", "application/xml", aliases: true));
        }
        catch (System.Xml.XmlException)
        {
            throw new ApiException(400, "The response must be valid XML.");
        }

        await using var transaction = await database.Database.BeginTransactionAsync();
        await Lock("soap", id, owner);
        var existing = await database.Operations.AsNoTracking().SingleOrDefaultAsync(candidateOperation => candidateOperation.ProjectId == id && candidateOperation.Name == previousName) ?? throw new ApiException(404, "Operation not found.");
        if (previousName != input.Name && await database.Operations.AnyAsync(candidateOperation => candidateOperation.ProjectId == id && candidateOperation.Name == input.Name))
            throw new ApiException(409, "An operation with this name already exists.");
        await database.Operations.Where(candidateOperation => candidateOperation.ProjectId == id && candidateOperation.Name == previousName).ExecuteDeleteAsync();
        var operation = new SoapOperation
        {
            ProjectId = id,
            Name = input.Name,
            SoapAction = input.SoapAction,
            RequestXml = input.RequestXml,
            ResponseXml = input.ResponseXml,
            Customized = true,
            Position = existing.Position
        };
        database.Operations.Add(operation);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return operation.Dto();
    }

    public static EndpointDto Validate(EndpointDto input)
    {
        input.Method = input.Method.ToUpperInvariant();
        if (!new[]
        {
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
        }.Contains(input.Method))
            throw new ApiException(400, "Invalid HTTP method.");
        input.Path = input.Path.Trim();
        if (input.Path.Length == 0 || input.Path.Contains('?') || input.Path.Contains('#'))
            throw new ApiException(400, "A path without a query or fragment is required.");
        if (!input.Path.StartsWith('/'))
            input.Path = "/" + input.Path;
        foreach (var type in new[]
        {
            input.RequestContentType,
            input.ResponseContentType
        }

        )
            if (!new[]
            {
                "application/json",
                "application/xml",
                "application/x-www-form-urlencoded"
            }.Contains(type))
                throw new ApiException(400, "Unsupported content type.");
        if (input.StatusCode is < 200 or > 599)
            throw new ApiException(400, "Status code must be 200–599.");
        if (input.RequestBodyExample.Trim().Length > 0)
            Template.ParseBody(input.RequestBodyExample, input.RequestContentType);
        if (input.RequireExactRequestValues && input.RequestBodyExample.Trim().Length == 0)
            throw new ApiException(400, "Exact value matching requires a request example.");
        var rendered = Template.Render(input.ResponseBody, input.RequestBodyExample, input.RequestContentType, input.ResponseContentType);
        if (rendered.Length > 0)
            Template.ParseBody(rendered, input.ResponseContentType);
        foreach (var header in input.ResponseHeaders)
            if (string.IsNullOrWhiteSpace(header.Key) || header.Key.Any(context => !char.IsAsciiLetterOrDigit(context) && !"!#$%&'*+-.^_`|~".Contains(context)) || header.Value.IndexOfAny(['\r', '\n']) >= 0)
                throw new ApiException(400, "Invalid response header.");
        return input;
    }

    private static RestEndpoint Entity(EndpointDto endpoint, string project, string id, int position) => new()
    {
        ProjectId = project,
        Id = id,
        Position = position,
        Method = endpoint.Method,
        Path = endpoint.Path,
        Description = endpoint.Description,
        RequestBodyExample = endpoint.RequestBodyExample,
        ResponseBody = endpoint.ResponseBody,
        StatusCode = endpoint.StatusCode,
        AuthenticationRequired = endpoint.AuthenticationRequired,
        RequireExactRequestValues = endpoint.RequireExactRequestValues,
        RequestContentType = endpoint.RequestContentType,
        ResponseContentType = endpoint.ResponseContentType,
        HeadersPresent = true,
        ResponseHeaders = endpoint.ResponseHeaders.Select(candidateHeader => new EndpointResponseHeader { ProjectId = project, EndpointId = id, Name = candidateHeader.Key, Value = candidateHeader.Value }).ToList()
    };
}
