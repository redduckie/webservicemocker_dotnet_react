using MockingBird.Common;
using MockingBird.Data.Entities;
using MockingBird.Services;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using MockingBird.Contracts;
using MockingBird.Data;
using Microsoft.EntityFrameworkCore;

namespace MockingBird.Infrastructure.Http;

public class SafeHttpClient(MockingBirdDbContext database, SettingsService settings)
{
    public static readonly HashSet<string> HopHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "connection",
        "content-length",
        "host",
        "proxy-authorization",
        "proxy-authenticate",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "keep-alive",
        "x-forwarded-for",
        "x-forwarded-host",
        "x-forwarded-proto"
    };
    public static bool Public(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
            return Public(address.MapToIPv4());
        var addressBytes = address.GetAddressBytes();
        if (addressBytes.Length == 4)
        {
            var firstOctet = addressBytes[0];
            var secondOctet = addressBytes[1];
            var thirdOctet = addressBytes[2];
            return !(firstOctet is 0 or 10 or 127 || firstOctet >= 224 || firstOctet == 100 && secondOctet >= 64 && secondOctet <= 127 || firstOctet == 169 && secondOctet == 254 || firstOctet == 172 && secondOctet >= 16 && secondOctet <= 31 || firstOctet == 192 && (secondOctet == 168 || secondOctet == 0 && (thirdOctet == 0 || thirdOctet == 2)) || firstOctet == 198 && (secondOctet is 18 or 19 || secondOctet == 51 && thirdOctet == 100) || firstOctet == 203 && secondOctet == 0 && thirdOctet == 113);
        }

        return addressBytes[0] >= 0x20 && addressBytes[0] <= 0x3f && !(addressBytes[0] == 0x20 && (addressBytes[1] == 2 || addressBytes[1] == 1 && (addressBytes[2] == 0 && addressBytes[3] == 0 || addressBytes[2] == 0x0d && addressBytes[3] == 0xb8)));
    }

    public async Task Permit(string email)
    {
        if (!(await settings.Get()).ExternalRequestsEnabled)
            throw new ApiException(403, "External requests are disabled by the administrator.");
        var minute = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        await database.Set<RateWindow>().Where(candidateRateWindow => candidateRateWindow.Minute < minute - 2).ExecuteDeleteAsync();
        var count = await database.Database.SqlQuery<int>($"INSERT INTO mockingbird.rate_windows(identity,minute,count) VALUES ({email},{minute},1) ON CONFLICT(identity,minute) DO UPDATE SET count=mockingbird.rate_windows.count+1 RETURNING count AS \"Value\"").ToListAsync();
        if (count[0] > 60)
            throw new ApiException(429, "Tester rate limit exceeded. Try again in a minute.");
    }

    public async Task<TesterResponse> Send(TesterRequest input, CancellationToken cancellation = default)
    {
        if (!Uri.TryCreate(input.Url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || uri.UserInfo.Length > 0)
            throw new ApiException(400, "Enter an HTTP or HTTPS URL without embedded credentials.");
        var host = uri.DnsSafeHost.TrimEnd('.').ToLowerInvariant();
        if (host == "localhost" || new[]
        {
            ".localhost",
            ".local",
            ".internal"
        }.Any(host.EndsWith) || host == "metadata.amazonaws.com")
            throw new ApiException(400, "Private or local destinations are not allowed.");
        var method = input.Method.ToUpperInvariant();
        if (!new[]
        {
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "HEAD",
            "OPTIONS"
        }.Contains(method))
            throw new ApiException(400, "Unsupported request method.");
        var bytes = Encoding.UTF8.GetBytes(input.Body);
        if (bytes.Length > 1024 * 1024)
            throw new ApiException(413, "Tester requests are limited to 1 MB.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        var watch = Stopwatch.StartNew();
        try
        {
            var addresses = IPAddress.TryParse(host, out var literal) ? [literal] : await Dns.GetHostAddressesAsync(host, timeout.Token);
            if (addresses.Length == 0 || addresses.Any(address => !Public(address)))
                throw new ApiException(400, "The destination must resolve only to public IP addresses.");
            using var handler = new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                UseProxy = false,
                AutomaticDecompression = DecompressionMethods.None,
                ConnectCallback = async (context, token) =>
                {
                    var socket = new Socket(addresses[0].AddressFamily, SocketType.Stream, ProtocolType.Tcp);
                    try
                    {
                        await socket.ConnectAsync(new IPEndPoint(addresses[0], context.DnsEndPoint.Port), token);
                        return new NetworkStream(socket, true);
                    }
                    catch
                    {
                        socket.Dispose();
                        throw;
                    }
                }
            };
            using var client = new HttpClient(handler);
            using var request = new HttpRequestMessage(new HttpMethod(method), uri);
            if (bytes.Length > 0 && method != "HEAD")
                request.Content = new ByteArrayContent(bytes);
            request.Headers.TryAddWithoutValidation("Accept-Encoding", "identity");
            if (input.Headers is { } headers)
                foreach (var header in headers)
                {
                    if (HopHeaders.Contains(header.Key) || header.Key.Equals("accept-encoding", StringComparison.OrdinalIgnoreCase))
                        continue;
                    var value = header.Value;
                    if (value.Length > 16_384 || value.IndexOfAny(['\r', '\n']) >= 0)
                        throw new ApiException(400, "Invalid request header.");
                    if (!request.Headers.TryAddWithoutValidation(header.Key, value))
                    {
                        request.Content ??= new ByteArrayContent([]);
                        request.Content.Headers.TryAddWithoutValidation(header.Key, value);
                    }
                }

            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            var result = await ReadBounded(stream, 2 * 1024 * 1024, timeout.Token);
            var responseHeaders = new Dictionary<string, string>();
            foreach (var header in response.Headers.Concat(response.Content.Headers))
                responseHeaders[header.Key] = string.Join(", ", header.Value);
            return new((int)response.StatusCode, response.ReasonPhrase ?? "", responseHeaders, Encoding.UTF8.GetString(result), watch.ElapsedMilliseconds, result.Length);
        }
        catch (OperationCanceledException)
        {
            throw new ApiException(504, "External request timed out.");
        }
        catch (Exception exception) when (exception is HttpRequestException or SocketException)
        {
            throw new ApiException(502, "External request failed.");
        }
    }

    public static async Task<byte[]> ReadBounded(Stream stream, int limit, CancellationToken token = default)
    {
        using var output = new MemoryStream();
        var buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = await stream.ReadAsync(buffer, token)) > 0)
        {
            if (output.Length + bytesRead > limit)
                throw new ApiException(413, "Payload exceeds the allowed size.");
            output.Write(buffer, 0, bytesRead);
        }

        return output.ToArray();
    }
}
