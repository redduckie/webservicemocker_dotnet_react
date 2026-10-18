using Microsoft.EntityFrameworkCore;
using MockingBird.Contracts;
using MockingBird.Data;
using MockingBird.Common;
using MockingBird.Services;
using static MockingBird.Endpoints.RequestBodyReader;

namespace MockingBird.Endpoints;

public static class AdministrationEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/admin/users", async (HttpContext httpContext, IdentityService identity, MockingBirdDbContext database) =>
        {
            await identity.Require(httpContext, admin: true);
            var users = await database.Users.AsNoTracking().Include(candidateUser => candidateUser.Features).OrderBy(candidateUser => candidateUser.Email).ToListAsync();
            return Results.Ok(users.Select(candidateUser => candidateUser.Dto(identity.Admin(candidateUser))));
        });
        app.MapPatch("/api/admin/users/{email}", async (string email, HttpContext httpContext, IdentityService identity, MockingBirdDbContext database) =>
        {
            var actor = await identity.Require(httpContext, admin: true);
            var user = await database.Users.Include(candidateUser => candidateUser.Features).SingleOrDefaultAsync(candidateUser => candidateUser.Email == email) ?? throw new ApiException(404, "User not found.");
            var userUpdate = await ReadAsync<UserUpdate>(httpContext);
            if ((identity.Admin(user) || user.Email == actor.Email) && userUpdate.Status == "rejected")
                throw new ApiException(400, "Administrator access cannot be revoked here.");
            if (userUpdate.Status != null)
            {
                if (userUpdate.Status is not ("approved" or "rejected"))
                    throw new ApiException(400, "Invalid status.");
                user.Status = userUpdate.Status;
                user.ReviewedAt = ApplicationValues.Now();
            }

            if (userUpdate.Features != null)
            {
                user.HasFeatures = true;
                foreach (var (name, enabled) in new[]
                {
                    ("soapMock", userUpdate.Features.SoapMock),
                    ("restMock", userUpdate.Features.RestMock),
                    ("requestCollections", userUpdate.Features.RequestCollections)
                }

                )
                {
                    var userFeature = user.Features.FirstOrDefault(candidateUserFeature => candidateUserFeature.Feature == name);
                    if (userFeature == null)
                        user.Features.Add(new() { UserId = user.Id, Feature = name, Enabled = enabled });
                    else
                        userFeature.Enabled = enabled;
                }
            }

            if (userUpdate.RotateKey || (user.Status == "approved" && string.IsNullOrEmpty(user.CredentialKey)))
                user.CredentialKey = IdentityService.NewKey();
            user.ApiKey = user.Status == "approved" ? user.CredentialKey : null;
            await database.SaveChangesAsync();
            return Results.Ok(new { success = true });
        });
        app.MapGet("/api/admin/settings", async (HttpContext httpContext, IdentityService identity, SettingsService settings) =>
        {
            await identity.Require(httpContext, admin: true);
            return Results.Ok(await settings.Get());
        });
        app.MapPut("/api/admin/settings", async (HttpContext httpContext, IdentityService identity, SettingsService settings) =>
        {
            await identity.Require(httpContext, admin: true);
            var settingsUpdate = await ReadAsync<SettingsDto>(httpContext);
            await settings.Save(settingsUpdate);
            return Results.Ok(settingsUpdate);
        });
    }
}
