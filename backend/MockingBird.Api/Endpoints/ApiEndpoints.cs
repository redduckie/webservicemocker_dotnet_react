namespace MockingBird.Endpoints;

public static class ApiEndpoints
{
    public static void Map(WebApplication app)
    {
        ApplicationEndpoints.Map(app);
        AuthenticationEndpoints.Map(app);
        AdministrationEndpoints.Map(app);
        ProjectEndpoints.Map(app, "rest");
        ProjectEndpoints.Map(app, "soap");
        CollectionEndpoints.Map(app);
        MockEndpoints.Map(app);
        FrontendEndpoints.Map(app);
    }
}
