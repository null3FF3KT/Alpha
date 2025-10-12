using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Cosmos;
using Azure.Identity;
using System.Net;

namespace ApiCSharp.Functions;

public class Status(DefaultAzureCredential cred)
{
    [Function("status")] 
    public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "status/{corrId}")] HttpRequestData req, string corrId)
    {
        if (string.IsNullOrWhiteSpace(corrId)) return req.CreateResponse(HttpStatusCode.BadRequest);
        var endpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT")!;
        var db = Environment.GetEnvironmentVariable("COSMOS_DB")!;
        var container = Environment.GetEnvironmentVariable("COSMOS_CONTAINER")!;
        var client = new CosmosClient(endpoint, cred);
        var resp = await client.GetDatabase(db).GetContainer(container).ReadItemAsync<dynamic>(corrId, new PartitionKey(corrId));
        var r = req.CreateResponse(HttpStatusCode.OK);
        await r.WriteAsJsonAsync(resp.Resource);
        return r;
    }
}
