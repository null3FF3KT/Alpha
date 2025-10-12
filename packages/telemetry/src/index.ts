import { NodeSDK } from '@opentelemetry/sdk-node';
import { AzureMonitorTraceExporter } from '@opentelemetry/exporter-azure-monitor';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function initTelemetry(connectionString: string) {
  const exporter = new AzureMonitorTraceExporter({ connectionString });
  const sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return sdk;
}
