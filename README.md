# Alpha Monorepo

- pnpm build/test/lint
- apps/client: React + RxJS + MSAL
- apps/api: Azure Functions TypeScript
- packages: contracts, telemetry

Dev: Use Azurite and Service Bus emulator. APIM mocked by functions host.

## Deployment

See [Deployment & GitHub Actions Setup](docs/deployment.md) for guidance on provisioning Azure resources and configuring the secrets that enable the automated deployments.
