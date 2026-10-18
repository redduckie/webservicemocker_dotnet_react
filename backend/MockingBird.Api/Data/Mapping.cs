using MockingBird.Data.Entities;
using MockingBird.Contracts;

namespace MockingBird.Data;

public static class Mapping
{
    public static EndpointDto Dto(this RestEndpoint endpoint) => new()
    {
        Id = endpoint.Id,
        Method = endpoint.Method ?? "GET",
        Path = endpoint.Path ?? "/",
        Description = endpoint.Description ?? "",
        RequestBodyExample = endpoint.RequestBodyExample ?? "",
        ResponseBody = endpoint.ResponseBody ?? "",
        StatusCode = endpoint.StatusCode ?? 200,
        AuthenticationRequired = endpoint.AuthenticationRequired ?? true,
        RequireExactRequestValues = endpoint.RequireExactRequestValues ?? false,
        RequestContentType = endpoint.RequestContentType ?? "application/json",
        ResponseContentType = endpoint.ResponseContentType ?? "application/json",
        ResponseHeaders = endpoint.ResponseHeaders.ToDictionary(candidateHeader => candidateHeader.Name, candidateHeader => candidateHeader.Value)
    };
    public static OperationDto Dto(this SoapOperation operation) => new(operation.Name, operation.SoapAction ?? "", operation.RequestXml, operation.ResponseXml ?? "", operation.Customized ?? false);
    public static ProjectDto Dto(this MockProject project) => new(project.Id, project.Name ?? "", project.CreatedAt ?? "", project.User.Email, project.Enabled, project.MockUrl, project.MockBaseUrl, project.WsdlContent, project.Endpoints.OrderBy(candidateEndpoint => candidateEndpoint.Position).ThenBy(candidateEndpoint => candidateEndpoint.Id).Select(candidateEndpoint => candidateEndpoint.Dto()).ToList(), project.Operations.OrderBy(candidateOperation => candidateOperation.Position).ThenBy(candidateOperation => candidateOperation.Name).Select(candidateOperation => candidateOperation.Dto()).ToList());
    public static SettingsDto Dto(this SystemSettings settings) => new(settings.LogRetentionDays ?? 2, settings.MaxLogsPerProject ?? 50, settings.MaxLoggedRequestBodyMb ?? 3, settings.ExternalRequestsEnabled ?? false);
    public static FeatureAccess Permissions(this AccessUser user, bool admin = false) => new(admin || user.Features.All(candidateUserFeature => candidateUserFeature.Feature != "soapMock" || candidateUserFeature.Enabled), admin || user.Features.All(candidateUserFeature => candidateUserFeature.Feature != "restMock" || candidateUserFeature.Enabled), admin || user.Features.All(candidateUserFeature => candidateUserFeature.Feature != "requestCollections" || candidateUserFeature.Enabled));
    public static UserDto Dto(this AccessUser user, bool admin = false) => new(user.Email, user.DisplayName ?? user.Email, user.Role, user.Status, user.RequestedAt, user.ReviewedAt, user.Permissions(admin));
    public static LogDto Dto(this RequestLog requestLog) => requestLog.Data with
    {
        Id = requestLog.Id,
        ProjectId = requestLog.ProjectId
    };
}
