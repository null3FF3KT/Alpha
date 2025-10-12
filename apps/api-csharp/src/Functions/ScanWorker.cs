using System.Text.Json;
using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Azure.Storage.Blobs;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace ApiCSharp.Functions;

public class ScanWorker(DefaultAzureCredential cred, ILogger<ScanWorker> logger)
{
    [Function("scanWorker")]
    public async Task Run([ServiceBusTrigger("ingest.scan", Connection = "ServiceBusConnection")] byte[] body)
    {
        var msg = JsonSerializer.Deserialize<IngestScanMessage>(body)!;
        var bs = new BlobServiceClient(new Uri(Environment.GetEnvironmentVariable("STORAGE_URL")!), cred);
        var url = new Uri(msg.blobUrl);
        var parts = url.AbsolutePath.Trim('/').Split('/', 2);
        var container = parts[0];
        var name = parts[1];
        var blob = bs.GetBlobContainerClient(container).GetBlobClient(name);
        var dl = await blob.DownloadContentAsync();
        var bytes = dl.Value.Content.ToArray();

        if (!AntivirusClean(bytes))
        {
            await Quarantine(bs, name, "virus");
            throw new Exception("virus");
        }

        try
        {
            var ok = await ContentSafetyOk(bytes);
            if (!ok)
            {
                await Quarantine(bs, name, "unsafe");
                throw new Exception("unsafe");
            }
        }
        catch
        {
            await Quarantine(bs, name, "safety_unavailable");
            throw;
        }

        var sb = new ServiceBusClient(Environment.GetEnvironmentVariable("SERVICEBUS_NAMESPACE")!, cred);
        var sender = sb.CreateSender(Environment.GetEnvironmentVariable("ANALYZE_QUEUE_NAME") ?? "ingest.analyze");
        await sender.SendMessageAsync(new ServiceBusMessage(JsonSerializer.SerializeToUtf8Bytes(new AnalyzeMessage { corrId = msg.corrId, blobUrl = msg.blobUrl })) { CorrelationId = msg.corrId, ContentType = "application/json" });
        await sender.CloseAsync();
        await sb.DisposeAsync();
    }

    private static bool AntivirusClean(ReadOnlySpan<byte> buf)
    {
        for (int i = 0; i < buf.Length - 2; i++) if (buf[i] == 0x56 && buf[i+1] == 0x49 && buf[i+2] == 0x52) return false; // VIR
        return true;
    }

    private static Task<bool> ContentSafetyOk(byte[] _bytes) => Task.FromResult(true);

    private static async Task Quarantine(BlobServiceClient bs, string name, string reason)
    {
        var src = bs.GetBlobContainerClient("incoming").GetBlobClient(name);
        var dst = bs.GetBlobContainerClient("quarantine").GetBlobClient(name);
        await dst.StartCopyFromUriAsync(src.Uri);
        await src.DeleteIfExistsAsync();
        await dst.SetTagsAsync(new Dictionary<string, string> { ["reason"] = reason });
    }
}

public record IngestScanMessage(string corrId, string blobUrl, string sasUrl, Dictionary<string,string> meta);
public record AnalyzeMessage { public string corrId { get; set; } = ""; public string blobUrl { get; set; } = ""; }
