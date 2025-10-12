API rewritten in .NET 8 isolated Functions.
- HttpIngest: validates headers, 10MB cap, PNG/JPEG sniffing, blob upload, SAS (user delegation), enqueue Service Bus.
- scanWorker: antivirus, fail-closed Content Safety, quarantine, enqueue analyze.
- analyzeWorker: fake Vision analyze, write analysis JSON, publish Event Grid.
- status: GET /status/{corrId} from Cosmos via MSI.
