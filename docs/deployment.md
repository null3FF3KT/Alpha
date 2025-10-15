# Deployment & GitHub Actions Setup

This guide explains how to provision the Azure resources that the **Alpha** project expects and how to wire them up to GitHub Actions secrets and application configuration.

## 1. Provision Azure resources

1. Sign in with the Azure CLI (`az login`).
2. Choose or create a resource group, e.g. `rg-alpha-prod` in `eastus`.
3. Deploy the shared resources defined in [`infra/main.bicep`](../infra/main.bicep). Supply a unique `name` prefix (it is reused to derive resource names such as storage, Service Bus, Key Vault, etc.).

   ```bash
   az deployment group create \
     --resource-group rg-alpha-prod \
     --template-file infra/main.bicep \
     --parameters name=alpha-prod
   ```

   This template creates:

   | Resource | Purpose |
   | --- | --- |
   | Storage account (`<name>` minus hyphens) with containers `incoming`, `quarantine`, `analysis` | Holds uploaded content and analysis output. [`HttpIngest`](../apps/api-csharp/src/Functions/HttpIngest.cs) and worker functions stream blobs from here.【F:infra/main.bicep†L1-L24】【F:apps/api-csharp/src/Functions/HttpIngest.cs†L17-L55】【F:apps/api-csharp/src/Functions/ScanWorker.cs†L15-L64】
   | Service Bus namespace `<name>-sb` with queues `ingest.scan` and `ingest.analyze` | Drives the scan/analyze workers.【F:infra/main.bicep†L26-L36】【F:apps/api-csharp/src/Functions/ScanWorker.cs†L37-L48】【F:apps/api-csharp/src/Functions/AnalyzeWorker.cs†L12-L29】
   | Application Insights component `<name>-ai` | Used by the client telemetry SDK.【F:infra/main.bicep†L38-L44】【F:apps/client/src/telemetry/appInsights.ts†L3-L6】
   | Key Vault, Event Grid topic, Cosmos DB account | Reserved for future use by the workers.【F:infra/main.bicep†L45-L68】

4. Deploy (or create via portal) the Static Web App using [`infra/staticwebapp.bicep`](../infra/staticwebapp.bicep). Point it at this GitHub repo and the branch that should trigger deployments.

   ```bash
   az deployment group create \
     --resource-group rg-alpha-prod \
     --template-file infra/staticwebapp.bicep \
     --parameters name=<swa-name> repoUrl=https://github.com/<org>/Alpha branch=main
   ```

   The SWA build configuration already matches the monorepo structure (client in `apps/client`, API in `apps/api-csharp/src`).【F:infra/staticwebapp.bicep†L1-L21】

## 2. Configure GitHub secrets

The deployment workflow [`deploy-swa.yml`](../.github/workflows/deploy-swa.yml) requires one manual secret: `AZURE_STATIC_WEB_APPS_API_TOKEN` for the Static Web App environment.【F:.github/workflows/deploy-swa.yml†L24-L33】

1. In the Azure Portal, open the Static Web App → **Manage deployment token**.
2. Copy the token and add it as a repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN` (`Settings → Secrets and variables → Actions`).
3. No other Azure credentials are required because the action uploads directly to the SWA using that token.

Once the secret is present, every push to `main` (or a manual `workflow_dispatch`) will build both the React frontend and the .NET isolated Functions API and upload them to the SWA.

## 3. Backend app settings (Azure Functions)

The Functions runtime that hosts `apps/api-csharp` reads several configuration values at runtime. Populate these as application settings for the SWA **API** or (if you run it as a standalone Functions app) in the Function App configuration blade.

| Setting | Value source | Used by |
| --- | --- | --- |
| `AzureWebJobsStorage` | Storage account connection string (Access keys → Connection string). | Functions runtime (required by Azure).【F:apps/api-csharp/local.settings.json†L2-L7】
| `ServiceBusConnection` | Service Bus namespace shared access policy connection string (e.g. RootManageSharedAccessKey). | Service Bus triggers for scan/analyze workers.【F:apps/api-csharp/local.settings.json†L4-L7】【F:apps/api-csharp/src/Functions/ScanWorker.cs†L12-L48】【F:apps/api-csharp/src/Functions/AnalyzeWorker.cs†L12-L28】
| `STORAGE_URL` | Blob service URL, e.g. `https://<storage-account>.blob.core.windows.net`. | Ingest + workers to reach storage.【F:apps/api-csharp/src/Functions/HttpIngest.cs†L36-L55】【F:apps/api-csharp/src/Functions/ScanWorker.cs†L15-L64】【F:apps/api-csharp/src/Functions/AnalyzeWorker.cs†L15-L29】
| `STORAGE_CONTAINER` *(optional)* | Overrides the ingress container (defaults to `incoming`). | HTTP ingest function.【F:apps/api-csharp/src/Functions/HttpIngest.cs†L36-L55】
| `SERVICEBUS_NAMESPACE` | Fully qualified Service Bus namespace, e.g. `<name>-sb.servicebus.windows.net`. | Service Bus senders.【F:apps/api-csharp/src/Functions/HttpIngest.cs†L56-L63】【F:apps/api-csharp/src/Functions/ScanWorker.cs†L37-L48】
| `SCAN_QUEUE_NAME` *(optional)* | Queue name if not `ingest.scan`. | HTTP ingest → scan handoff.【F:apps/api-csharp/src/Functions/HttpIngest.cs†L56-L63】
| `ANALYZE_QUEUE_NAME` *(optional)* | Queue name if not `ingest.analyze`. | Scan → analyze handoff.【F:apps/api-csharp/src/Functions/ScanWorker.cs†L37-L48】
| `EVENTGRID_TOPIC_ENDPOINT` | Event Grid topic endpoint URI from `<name>-eg-topic`. | Analyze worker publishes completion events.【F:apps/api-csharp/src/Functions/AnalyzeWorker.cs†L30-L34】
| `EVENTGRID_KEY` *(optional)* | Access key for the Event Grid topic. Omit if the managed identity has Event Grid Data Sender access. | Analyze worker authentication fallback.【F:apps/api-csharp/src/Functions/AnalyzeWorker.cs†L30-L37】

Because the Functions app uses `DefaultAzureCredential`, you can alternatively assign a managed identity and grant it access to Storage (Blob Data Contributor), Service Bus (Data Sender), and Event Grid (Data Sender) to reduce the number of secrets. If you do so, only the connection strings that Azure requires (`AzureWebJobsStorage` and `ServiceBusConnection` for trigger bindings) need to remain as secrets.

## 4. Frontend build variables (Vite)

GitHub Actions injects `VITE_*` variables at build time. Configure these as Static Web App **Application settings → Configuration → Frontend** or set them locally in `.env` files when testing with Vite.

| Variable | Purpose |
| --- | --- |
| `VITE_APPINSIGHTS_CONNECTION_STRING` | Copy from the Application Insights component (`Connection string`). Enables browser telemetry.【F:apps/client/src/telemetry/appInsights.ts†L3-L6】
| `VITE_AAD_TENANT_ID` | Azure AD tenant that owns the client app registration.【F:apps/client/src/msalConfig.ts†L8-L15】
| `VITE_AAD_CLIENT_ID` | Client ID of the SPA app registration (redirect URI must include the SWA domain).【F:apps/client/src/msalConfig.ts†L8-L15】
| `VITE_REDIRECT_URI` *(optional)* | Override redirect URI (defaults to window origin).【F:apps/client/src/msalConfig.ts†L8-L15】
| `VITE_APIM_SCOPE` | Scope or resource for API calls (e.g. `api://<apim-app-id>/.default`).【F:apps/client/src/msalConfig.ts†L15-L16】
| `VITE_APIM_BASE_URL` | Base URL of the API Management or Functions proxy endpoint the SPA calls.【F:apps/client/src/msalConfig.ts†L15-L16】

After setting the secrets and configuration values, trigger the **Deploy SWA** workflow manually once (`Actions → Deploy SWA → Run workflow`) to verify that the token and environment settings are correct.
