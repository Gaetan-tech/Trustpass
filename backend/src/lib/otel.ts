// Instrumentation OpenTelemetry → Azure Application Insights (BLOC 4, §3.2.3).
// DOIT être importé en TOUT PREMIER (avant express/http/prisma) pour que
// l'auto-instrumentation patche les modules à leur premier require.
// No-op si APPLICATIONINSIGHTS_CONNECTION_STRING est absente (dev/test) : les
// instruments métier (lib/metrics.ts) retombent alors sur un meter no-op.
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (conn && process.env.NODE_ENV !== 'test') {
  process.env.OTEL_SERVICE_NAME ??= 'trustpass-api';
  useAzureMonitor({
    azureMonitorExporterOptions: { connectionString: conn },
    // Échantillonnage des traces (100 % en démo ; à réduire sous forte charge).
    samplingRatio: 1,
  });

  console.log('[otel] Azure Monitor OpenTelemetry activé (traces + métriques + logs)');
}
