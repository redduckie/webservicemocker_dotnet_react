using System.Security.Cryptography;
using System.Text;

namespace MockingBird.Infrastructure.Security;

public sealed class CollectionCipher
{
    private readonly byte[] key;
    public CollectionCipher(IConfiguration config) : this(config["Collections:EncryptionSecret"] ?? throw new InvalidOperationException("Set Collections:EncryptionSecret to the existing application's secret."))
    {
    }

    public CollectionCipher(string secret) => key = HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(secret), 32, Encoding.UTF8.GetBytes("mockingbird"), Encoding.UTF8.GetBytes("tester-collections:v1"));
    public string Encrypt(string value, string associatedData)
    {
        using var aesGcm = new AesGcm(key, 16);
        var initializationVector = RandomNumberGenerator.GetBytes(12);
        var bytes = Encoding.UTF8.GetBytes(value);
        var cipher = new byte[bytes.Length];
        var authenticationTag = new byte[16];
        aesGcm.Encrypt(initializationVector, bytes, cipher, authenticationTag, Encoding.UTF8.GetBytes(associatedData));
        return $"v1:{Convert.ToBase64String(initializationVector)}:{Convert.ToBase64String(authenticationTag)}:{Convert.ToBase64String(cipher)}";
    }

    public string Decrypt(string? value, string associatedData)
    {
        if (value == null)
            return "";
        using var aesGcm = new AesGcm(key, 16);
        var parts = value.Split(':');
        if (parts.Length != 4 || parts[0] != "v1")
            throw new CryptographicException("Unsupported encrypted field.");
        var ciphertext = Convert.FromBase64String(parts[3]);
        var plaintextBytes = new byte[ciphertext.Length];
        aesGcm.Decrypt(Convert.FromBase64String(parts[1]), ciphertext, Convert.FromBase64String(parts[2]), plaintextBytes, Encoding.UTF8.GetBytes(associatedData));
        return Encoding.UTF8.GetString(plaintextBytes);
    }

    public static (string scope, string root) Keys(string email, string id)
    {
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(email.Trim().ToLowerInvariant())));
        var prefix = $"mockingbird:tester:{{{hash}}}";
        return (prefix + ":collections", prefix + ":collection:" + id);
    }
}
