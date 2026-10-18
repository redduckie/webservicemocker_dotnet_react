using MockingBird.Configuration;
using MockingBird.Endpoints;
using MockingBird.Middleware;

var builder = WebApplication.CreateBuilder(args);
builder.AddApplicationConfiguration(args);
builder.AddApiServices();
builder.AddApiAuthentication();
builder.AddApiDocumentation();

var app = builder.Build();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseApiDocumentation();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AntiforgeryMiddleware>();

ApiEndpoints.Map(app);
app.Run();
