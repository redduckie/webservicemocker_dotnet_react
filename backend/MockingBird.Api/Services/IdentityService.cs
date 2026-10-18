using MockingBird.Common;
using MockingBird.Data.Entities;
using MockingBird.Infrastructure.Security;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using MockingBird.Data;

namespace MockingBird.Services;

public class IdentityService(MockingBirdDbContext database, IConfiguration config)
{
    public bool Admin(string email) => (config.GetSection("Access:AdminEmails").Get<string[]>() ?? []).Contains(email, StringComparer.OrdinalIgnoreCase);
    public bool Admin(AccessUser user) => Admin(user.Email) || user.Role == "admin";
    public static string? ExplicitKey(HttpRequest request)
    {
        if (request.Headers.TryGetValue("x-api-key", out var key) || request.Headers.TryGetValue("x-mockingbird-apikey", out key))
            return key.ToString();
        var auth = request.Headers.Authorization.ToString();
        if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return auth[7..];
        if (auth.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var decodedCredentials = Encoding.UTF8.GetString(Convert.FromBase64String(auth[6..]));
                return decodedCredentials.Contains(':') ? decodedCredentials[(decodedCredentials.IndexOf(':') + 1)..] : "";
            }
            catch (FormatException)
            {
                return "";
            }
        }

        return null;
    }

    public async Task<AccessUser?> ByKey(string key) => string.IsNullOrWhiteSpace(key) ? null : await database.Users.AsNoTracking().Include(candidateUser => candidateUser.Features).SingleOrDefaultAsync(candidateUser => candidateUser.ApiKey == key && candidateUser.Status == "approved");
    public async Task<AccessUser?> Current(HttpContext httpContext, bool approved = true)
    {
        var key = ExplicitKey(httpContext.Request);
        if (key != null)
            return await ByKey(key);
        var email = httpContext.User.FindFirstValue(ClaimTypes.Email);
        if (email == null)
            return null;
        var user = await database.Users.AsNoTracking().Include(candidateUser => candidateUser.Features).SingleOrDefaultAsync(candidateUser => candidateUser.Email == email);
        return user == null || approved && user.Status != "approved" ? null : user;
    }

    public async Task<AccessUser> Require(HttpContext httpContext, string? feature = null, bool admin = false)
    {
        var user = await Current(httpContext) ?? throw new ApiException(401, "Sign in with an approved account or a valid API key.");
        if (admin && !Admin(user))
            throw new ApiException(403, "Administrator access required.");
        if (feature != null && !Admin(user) && user.Features.Any(candidateUserFeature => candidateUserFeature.Feature == feature && !candidateUserFeature.Enabled))
            throw new ApiException(403, "This feature is not enabled for your account.");
        return user;
    }

    public static string NewKey() => "mb_" + Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(24));
    public async Task<AccessUser> GoogleUser(string email, string name)
    {
        email = email.Trim().ToLowerInvariant();
        var user = await database.Users.SingleOrDefaultAsync(candidateUser => candidateUser.Email == email);
        if (user == null)
        {
            user = new()
            {
                Email = email,
                EncryptionScope = CollectionCipher.Keys(email, "").scope,
                DisplayName = name,
                Status = "pending",
                Role = "user",
                RequestedAt = ApplicationValues.Now()
            };
            database.Users.Add(user);
        }

        if (Admin(email))
        {
            user.Role = "admin";
            user.Status = "approved";
            user.CredentialKey ??= NewKey();
            user.ApiKey = user.CredentialKey;
        }

        await database.SaveChangesAsync();
        return user;
    }

    public static Task SignIn(HttpContext httpContext, AccessUser user) => httpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.Email, user.Email), new Claim(ClaimTypes.Name, user.DisplayName ?? user.Email) }, CookieAuthenticationDefaults.AuthenticationScheme)), new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7) });
}
