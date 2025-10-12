using System.Text.Json;
using Azure;
using Azure.Identity;
using Azure.Messaging.EventGrid;
using Azure.Storage.Blobs;
using Microsoft.Azure.Functions.Worker;

namespace ApiCSharp.Functions;

public class AnalyzeWorker(DefaultAzureCredential cred)
{
    [Function("analyzeWorker")]
    public async Task Run([ServiceBusTrigger("ingest.analyze", Connection = "ServiceBusConnection")] byte[] body)
    {
        var msg = JsonSerializer.Deserialize<AnalyzeMessage>(body)!;
        var bs = new BlobServiceClient(new Uri(Environment.GetEnvironmentVariable("STORAGE_URL")!), cred);
        var url = new Uri(msg.blobUrl);
        var parts = url.AbsolutePath.Trim('/').Split('/', 2);
        var container = parts[0];
        var name = parts[1];
        var blob = bs.GetBlobContainerClient(container).GetBlobClient(name);
        var dl = await blob.DownloadContentAsync();
        var bytes = dl.Value.Content.ToArray();

        var results = new { labels = new[] { "example" }, score = 0.9 };
        var outBlob = bs.GetBlobContainerClient("analysis").GetBlobClient($"{msg.corrId}.json");
        await outBlob.UploadAsync(new BinaryData(JsonSerializer.Serialize(results)), overwrite: true);

        var topicEndpoint = new Uri(Environment.GetEnvironmentVariable("EVENTGRID_TOPIC_ENDPOINT")!);
        var key = Environment.GetEnvironmentVariable("EVENTGRID_KEY");
        EventGridPublisherClient client = key is not null
            ? new EventGridPublisherClient(topicEndpoint, new AzureKeyCredential(key))
            : new EventGridPublisherClient(topicEndpoint, cred);

        await client.SendEventAsync(new CloudEvent($"content/{msg.corrId}", "content.analyzed", new { corrId = msg.corrId, resultUrl = outBlob.Uri }));
    }
}
