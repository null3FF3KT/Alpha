using System.Net;
using System.Text.Json;
using System.Text;
using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace ApiCSharp.Functions;

public class HttpIngest(DefaultAzureCredential cred, ILogger<HttpIngest> logger)
{
    private static readonly string[] Allowed = ["image/png", "image/jpeg"];
    private const int Max = 10 * 1024 * 1024;

    [Function("httpIngest")]
    public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
    {
        if (!req.Headers.TryGetValues("Content-Type", out var ct) || !Allowed.Contains(ct.First()))
            return req.CreateResponse(HttpStatusCode.UnsupportedMediaType);
        var sizeHeader = req.Headers.TryGetValues("X-Content-Size", out var xs) ? xs.First() : "0";
        if (!int.TryParse(sizeHeader, out var size) || size <= 0 || size > Max)
            return req.CreateResponse((HttpStatusCode)413);

        using var ms = new MemoryStream();
        await req.Body.CopyToAsync(ms);
        if (ms.Length > Max) return req.CreateResponse((HttpStatusCode)413);
        var bytes = ms.ToArray();

        // Security: server-side MIME sniffing prevents spoofed Content-Type headers.
        if (!IsPng(bytes) && !IsJpeg(bytes))
            return req.CreateResponse(HttpStatusCode.UnsupportedMediaType);

        var corrId = Guid.NewGuid().ToString();
        var blobService = new BlobServiceClient(new Uri(Environment.GetEnvironmentVariable("STORAGE_URL")!), cred);
        var container = blobService.GetBlobContainerClient(Environment.GetEnvironmentVariable("STORAGE_CONTAINER") ?? "incoming");
        var blob = container.GetBlobClient(corrId);
        await blob.UploadAsync(new BinaryData(bytes), overwrite: true);
        await blob.SetHttpHeadersAsync(new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = ct.First() });
        await blob.SetMetadataAsync(new Dictionary<string, string>
        {
            ["corrId"] = corrId,
            ["contentType"] = ct.First(),
            ["contentLength"] = bytes.Length.ToString()
        });

        var sas = await GetSasAsync(blobService, container.Name, blob.Name);

        var sb = new ServiceBusClient(Environment.GetEnvironmentVariable("SERVICEBUS_NAMESPACE")!, cred);
        var sender = sb.CreateSender(Environment.GetEnvironmentVariable("SCAN_QUEUE_NAME") ?? "ingest.scan");
        var msgBody = JsonSerializer.Serialize(new { corrId, blobUrl = blob.Uri.ToString(), sasUrl = $"{blob.Uri}?{sas}", meta = new { } });
        await sender.SendMessageAsync(new ServiceBusMessage(Encoding.UTF8.GetBytes(msgBody)) { CorrelationId = corrId, ContentType = "application/json" });
        await sender.CloseAsync();
        await sb.DisposeAsync();

        var resp = req.CreateResponse(HttpStatusCode.Accepted);
        await resp.WriteAsJsonAsync(new { corrId });
        return resp;
    }

    internal static bool IsPng(ReadOnlySpan<byte> b) => b.Length >= 8 && b[..8].SequenceEqual(new byte[]{0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A});
    internal static bool IsJpeg(ReadOnlySpan<byte> b) => b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[^2] == 0xFF && b[^1] == 0xD9;

    private static async Task<string> GetSasAsync(BlobServiceClient svc, string container, string name)
    {
        var startsOn = DateTimeOffset.UtcNow.AddMinutes(-1);
        var expiresOn = DateTimeOffset.UtcNow.AddMinutes(5);
        var key = await svc.GetUserDelegationKeyAsync(startsOn, expiresOn);
        var sas = new BlobSasBuilder(Azure.Storage.Sas.BlobSasPermissions.Read, expiresOn)
        {
            BlobContainerName = container,
            BlobName = name,
            Protocol = SasProtocol.Https,
            StartsOn = startsOn,
        };
        return sas.ToSasQueryParameters(key.Value, svc.AccountName).ToString();
    }
}
