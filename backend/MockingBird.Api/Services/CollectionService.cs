using MockingBird.Common;
using MockingBird.Data.Entities;
using MockingBird.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using MockingBird.Contracts;
using MockingBird.Data;
using System.Text.RegularExpressions;

namespace MockingBird.Services;

public class CollectionService(MockingBirdDbContext database, CollectionCipher cipher)
{
    private async Task<(Guid scope, string root)> Keys(string email, string id)
    {
        var user = await database.Users.AsNoTracking().SingleOrDefaultAsync(candidateUser => candidateUser.Email == email) ?? throw new ApiException(404, "User not found.");
        return (user.Id, user.EncryptionScope[..^":collections".Length] + ":collection:" + id);
    }

    public async Task<List<CollectionSummary>> List(string email)
    {
        var keys = await Keys(email, "");
        var scope = keys.scope;
        var rows = await database.Collections.AsNoTracking().Where(candidateCollection => candidateCollection.Owner == scope).OrderByDescending(candidateCollection => candidateCollection.UpdatedAt).ThenBy(candidateCollection => candidateCollection.Id).Select(candidateCollection => new { candidateCollection.Id, candidateCollection.NameEncrypted, candidateCollection.Mode, candidateCollection.Revision, candidateCollection.UpdatedAt, candidateCollection.RequestCount }).ToListAsync();
        return rows.Select(candidateCollection => new CollectionSummary(candidateCollection.Id, cipher.Decrypt(candidateCollection.NameEncrypted, keys.root + candidateCollection.Id + ":metadata:name"), candidateCollection.Mode ?? "rest", candidateCollection.Revision, candidateCollection.UpdatedAt ?? "", candidateCollection.RequestCount ?? 0)).ToList();
    }

    public async Task<CollectionDto?> Get(string email, string id)
    {
        var keys = await Keys(email, id);
        var row = await database.Collections.AsNoTracking().AsSplitQuery().Include(candidateCollection => candidateCollection.Variables).Include(candidateCollection => candidateCollection.SensitiveVariables).Include(candidateCollection => candidateCollection.Requests).ThenInclude(candidateCollectionRequest => candidateCollectionRequest.Headers).Include(candidateCollection => candidateCollection.Requests).ThenInclude(candidateCollectionRequest => candidateCollectionRequest.Operations).SingleOrDefaultAsync(candidateCollection => candidateCollection.Owner == keys.scope && candidateCollection.Id == id);
        if (row == null)
            return null;
        var associatedData = keys.root + ":metadata";
        return new()
        {
            Id = id,
            Name = cipher.Decrypt(row.NameEncrypted, associatedData + ":name"),
            Mode = row.Mode ?? "rest",
            Revision = row.Revision,
            UpdatedAt = row.UpdatedAt ?? "",
            RequestCount = row.RequestCount ?? 0,
            Variables = row.Variables.OrderBy(candidateVariable => candidateVariable.Position).Select((candidateVariable, index) => new { Name = cipher.Decrypt(candidateVariable.NameEncrypted, associatedData + ":variable:" + index + ":name"), Value = cipher.Decrypt(candidateVariable.ValueEncrypted, associatedData + ":variable:" + index + ":value") }).ToDictionary(candidateVariable => candidateVariable.Name, candidateVariable => candidateVariable.Value),
            SensitiveVariables = row.SensitiveVariables.OrderBy(candidateSensitiveVariable => candidateSensitiveVariable.Position).Select((candidateSensitiveVariable, index) => cipher.Decrypt(candidateSensitiveVariable.NameEncrypted, associatedData + ":sensitive:" + index)).ToList(),
            Requests = row.Requests.OrderBy(candidateCollectionRequest => candidateCollectionRequest.Position).ThenBy(candidateCollectionRequest => candidateCollectionRequest.Id).Select(candidateCollectionRequest => Decode(candidateCollectionRequest, keys.root + ":request:" + candidateCollectionRequest.Id)).ToList()
        };
    }

    public static void Validate(CollectionDto data)
    {
        data.Name = data.Name.Trim();
        if (data.Name.Length is < 1 or > 120)
            throw new ApiException(400, "Collection names must contain 1–120 characters.");
        if (data.Mode is not ("rest" or "soap"))
            throw new ApiException(400, "Specify REST or SOAP collection type.");
        var ids = new HashSet<string>();
        foreach (var requestDraft in data.Requests)
        {
            if (requestDraft.Id.Length is < 1 or > 150 || !ids.Add(requestDraft.Id))
                throw new ApiException(400, "Request IDs must be unique and nonempty.");
            if (requestDraft.Mode != data.Mode)
                throw new ApiException(400, "REST and SOAP requests cannot be mixed.");
            if (!new[]
            {
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "HEAD",
                "OPTIONS"
            }.Contains(requestDraft.Method))
                throw new ApiException(400, "Unsupported request method.");
            if (!new[]
            {
                "none",
                "bearer",
                "basic",
                "apiKey"
            }.Contains(requestDraft.AuthType))
                throw new ApiException(400, "Unsupported authentication type.");
            requestDraft.Headers = requestDraft.Headers.Select((candidateHeader, index) => candidateHeader with { Id = index + 1 }).ToList();
        }

        foreach (var name in data.Variables.Keys.Concat(data.SensitiveVariables))
            if (name.Length > 120 || !Regex.IsMatch(name, "^[a-zA-Z_][a-zA-Z0-9_.-]*$"))
                throw new ApiException(400, "Invalid variable name.");
        if (data.SensitiveVariables.Distinct().Count() != data.SensitiveVariables.Count)
            throw new ApiException(400, "Sensitive variable names must be unique.");
    }

    public async Task<CollectionDto> Save(string email, string id, CollectionDto data, bool create = false, bool delta = false)
    {
        Validate(data);
        var revision = create ? "" : data.Revision;
        if (!create && revision.Length == 0)
            throw new ApiException(400, "A saved revision is required.");
        var encryptionKeys = await Keys(email, id);
        await using var transaction = await database.Database.BeginTransactionAsync();
        var row = create ? null : await database.Collections.SingleOrDefaultAsync(candidateCollection => candidateCollection.Owner == encryptionKeys.scope && candidateCollection.Id == id);
        if (!create && (row == null || row.Revision != revision))
            throw Conflict();
        if (row != null && row.Mode != data.Mode)
            throw new ApiException(400, "A saved collection's type cannot be changed.");
        var prior = await database.Requests.Where(candidateCollectionRequest => candidateCollectionRequest.Owner == encryptionKeys.scope && candidateCollectionRequest.CollectionId == id).Select(candidateCollectionRequest => new { candidateCollectionRequest.Id, candidateCollectionRequest.Position }).ToListAsync();
        var order = delta ? data.Order ?? throw new ApiException(400, "Invalid request order.") : data.Requests.Select(candidateRequestDraft => candidateRequestDraft.Id).ToList();
        var valid = prior.Select(candidateRequest => candidateRequest.Id).Concat(data.Requests.Select(candidateRequestDraft => candidateRequestDraft.Id)).ToHashSet();
        if (order.Distinct().Count() != order.Count || order.Any(requestId => !valid.Contains(requestId)) || data.Requests.Any(candidateRequestDraft => !order.Contains(candidateRequestDraft.Id)))
            throw new ApiException(400, "Invalid request references.");
        if (row == null)
        {
            row = new()
            {
                Owner = encryptionKeys.scope,
                Id = id
            };
            database.Collections.Add(row);
        }

        row.Revision = ApplicationValues.Id();
        row.NameEncrypted = cipher.Encrypt(data.Name, encryptionKeys.root + ":metadata:name");
        row.Mode = data.Mode;
        row.UpdatedAt = ApplicationValues.Now();
        row.RequestCount = order.Count;
        row.VariablesPresent = true;
        row.SensitivePresent = true;
        // Claim the revision before changing child rows. The transaction makes the entire save atomic.
        try
        {
            await database.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw Conflict();
        }

        await database.Set<CollectionVariable>().Where(candidateVariable => candidateVariable.Owner == encryptionKeys.scope && candidateVariable.CollectionId == id).ExecuteDeleteAsync();
        await database.Set<CollectionSensitiveVariable>().Where(candidateSensitiveVariable => candidateSensitiveVariable.Owner == encryptionKeys.scope && candidateSensitiveVariable.CollectionId == id).ExecuteDeleteAsync();
        var variablePosition = 0;
        foreach (var variable in data.Variables)
        {
            var associatedData = encryptionKeys.root + ":metadata:variable:" + variablePosition;
            database.Add(new CollectionVariable { Owner = encryptionKeys.scope, CollectionId = id, Position = ++variablePosition, NameEncrypted = cipher.Encrypt(variable.Key, associatedData + ":name"), ValueEncrypted = cipher.Encrypt(variable.Value, associatedData + ":value") });
        }

        for (int index = 0; index < data.SensitiveVariables.Count; index++)
            database.Add(new CollectionSensitiveVariable { Owner = encryptionKeys.scope, CollectionId = id, Position = index + 1, NameEncrypted = cipher.Encrypt(data.SensitiveVariables[index], encryptionKeys.root + ":metadata:sensitive:" + index) });
        var changed = data.Requests.Select(candidateRequestDraft => candidateRequestDraft.Id).ToList();
        await database.Requests.Where(candidateCollectionRequest => candidateCollectionRequest.Owner == encryptionKeys.scope && candidateCollectionRequest.CollectionId == id && (!order.Contains(candidateCollectionRequest.Id) || changed.Contains(candidateCollectionRequest.Id))).ExecuteDeleteAsync();
        foreach (var requestDraft in data.Requests)
            database.Requests.Add(Encode(requestDraft, encryptionKeys.scope, id, order.IndexOf(requestDraft.Id) + 1, encryptionKeys.root + ":request:" + requestDraft.Id));
        foreach (var priorRequest in prior.Where(candidatePriorRequest => order.Contains(candidatePriorRequest.Id) && !changed.Contains(candidatePriorRequest.Id) && candidatePriorRequest.Position != order.IndexOf(candidatePriorRequest.Id) + 1))
        {
            var position = order.IndexOf(priorRequest.Id) + 1;
            await database.Requests.Where(candidateCollectionRequest => candidateCollectionRequest.Owner == encryptionKeys.scope && candidateCollectionRequest.CollectionId == id && candidateCollectionRequest.Id == priorRequest.Id).ExecuteUpdateAsync(propertySetters => propertySetters.SetProperty(candidateCollectionRequest => candidateCollectionRequest.Position, position));
        }

        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        data.Id = id;
        data.Revision = row.Revision;
        data.UpdatedAt = row.UpdatedAt!;
        data.RequestCount = order.Count;
        data.Order = null;
        return data;
    }

    public async Task Delete(string email, string id, string revision)
    {
        if (string.IsNullOrEmpty(revision))
            throw new ApiException(400, "A saved revision is required.");
        var scope = (await Keys(email, id)).scope;
        if (await database.Collections.Where(candidateCollection => candidateCollection.Owner == scope && candidateCollection.Id == id && candidateCollection.Revision == revision).ExecuteDeleteAsync() != 1)
            throw Conflict();
    }

    public static ApiException Conflict() => new(409, "This collection changed in another tab or was deleted. Export your changes, then reload before saving.");
    private CollectionRequest Encode(RequestDraft requestDraft, Guid owner, string collectionId, int position, string associatedData)
    {
        string EncryptField(string text, string field) => cipher.Encrypt(text, associatedData + ":" + field);
        var collectionRequest = new CollectionRequest
        {
            Owner = owner,
            CollectionId = collectionId,
            Id = requestDraft.Id,
            Position = position,
            Mode = requestDraft.Mode,
            Method = requestDraft.Method,
            AuthType = requestDraft.AuthType,
            NameEncrypted = EncryptField(requestDraft.Name, "name"),
            UrlEncrypted = EncryptField(requestDraft.Url, "url"),
            BodyEncrypted = EncryptField(requestDraft.Body, "body"),
            TokenEncrypted = EncryptField(requestDraft.Token, "token"),
            UsernameEncrypted = EncryptField(requestDraft.Username, "username"),
            PasswordEncrypted = EncryptField(requestDraft.Password, "password"),
            ApiKeyNameEncrypted = EncryptField(requestDraft.ApiKeyName, "apiKeyName"),
            WsdlUrlEncrypted = EncryptField(requestDraft.WsdlUrl, "wsdlUrl"),
            WsdlNameEncrypted = EncryptField(requestDraft.WsdlName, "wsdlName"),
            SelectedOperationEncrypted = EncryptField(requestDraft.SelectedOperation, "selectedOperation"),
            PreRequestScriptEncrypted = requestDraft.PreRequestScript == null ? null : EncryptField(requestDraft.PreRequestScript, "preRequestScript"),
            PostResponseScriptEncrypted = requestDraft.PostResponseScript == null ? null : EncryptField(requestDraft.PostResponseScript, "postResponseScript"),
            HeadersPresent = true,
            OperationsPresent = true
        };
        collectionRequest.Headers = requestDraft.Headers.Select((candidateHeader, index) => new CollectionRequestHeader { Owner = owner, CollectionId = collectionId, RequestId = requestDraft.Id, Position = index + 1, HeaderId = index + 1, NameEncrypted = EncryptField(candidateHeader.Name, "header:" + index + ":name"), ValueEncrypted = EncryptField(candidateHeader.Value, "header:" + index + ":value") }).ToList();
        collectionRequest.Operations = requestDraft.Operations.Select((candidateOperation, index) => new CollectionRequestOperation { Owner = owner, CollectionId = collectionId, RequestId = requestDraft.Id, Position = index + 1, NameEncrypted = EncryptField(candidateOperation.Name, "operation:" + index + ":name"), SoapActionEncrypted = EncryptField(candidateOperation.SoapAction, "operation:" + index + ":soapAction"), RequestXmlEncrypted = candidateOperation.RequestXml == null ? null : EncryptField(candidateOperation.RequestXml, "operation:" + index + ":requestXml") }).ToList();
        return collectionRequest;
    }

    private RequestDraft Decode(CollectionRequest collectionRequest, string associatedData)
    {
        string DecryptField(string? text, string field) => cipher.Decrypt(text, associatedData + ":" + field);
        return new()
        {
            Id = collectionRequest.Id,
            Mode = collectionRequest.Mode ?? "rest",
            Method = collectionRequest.Method ?? "GET",
            AuthType = collectionRequest.AuthType ?? "none",
            Name = DecryptField(collectionRequest.NameEncrypted, "name"),
            Url = DecryptField(collectionRequest.UrlEncrypted, "url"),
            Body = DecryptField(collectionRequest.BodyEncrypted, "body"),
            Token = DecryptField(collectionRequest.TokenEncrypted, "token"),
            Username = DecryptField(collectionRequest.UsernameEncrypted, "username"),
            Password = DecryptField(collectionRequest.PasswordEncrypted, "password"),
            ApiKeyName = DecryptField(collectionRequest.ApiKeyNameEncrypted, "apiKeyName"),
            WsdlUrl = DecryptField(collectionRequest.WsdlUrlEncrypted, "wsdlUrl"),
            WsdlName = DecryptField(collectionRequest.WsdlNameEncrypted, "wsdlName"),
            SelectedOperation = DecryptField(collectionRequest.SelectedOperationEncrypted, "selectedOperation"),
            PreRequestScript = collectionRequest.PreRequestScriptEncrypted == null ? null : DecryptField(collectionRequest.PreRequestScriptEncrypted, "preRequestScript"),
            PostResponseScript = collectionRequest.PostResponseScriptEncrypted == null ? null : DecryptField(collectionRequest.PostResponseScriptEncrypted, "postResponseScript"),
            Headers = collectionRequest.Headers.OrderBy(candidateHeader => candidateHeader.Position).Select((candidateHeader, index) => new HeaderDto(candidateHeader.HeaderId ?? index + 1, DecryptField(candidateHeader.NameEncrypted, "header:" + index + ":name"), DecryptField(candidateHeader.ValueEncrypted, "header:" + index + ":value"))).ToList(),
            Operations = collectionRequest.Operations.OrderBy(candidateOperation => candidateOperation.Position).Select((candidateOperation, index) => new OperationDto(DecryptField(candidateOperation.NameEncrypted, "operation:" + index + ":name"), DecryptField(candidateOperation.SoapActionEncrypted, "operation:" + index + ":soapAction"), candidateOperation.RequestXmlEncrypted == null ? null : DecryptField(candidateOperation.RequestXmlEncrypted, "operation:" + index + ":requestXml"))).ToList()
        };
    }
}
