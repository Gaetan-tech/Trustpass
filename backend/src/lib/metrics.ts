// Métriques d'exploitation au format Prometheus — TrustPass (BLOC 4, §3.2.2).
// Exposées par GET /api/v1/metrics (prom-client). Combine les signaux dorés
// (latence, trafic, erreurs, saturation) et des compteurs métier propres au
// produit, seuls capables de révéler certaines pannes silencieuses.
import client from 'prom-client';
import { metrics as otelApi } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';
import { getNotificationsQueue } from './queue.js';
import { env } from '../config/env.js';

// Meter OpenTelemetry (export vers Application Insights si le distro Azure Monitor
// est actif — cf. lib/otel.ts). Sinon, meter no-op : les enregistrements sont ignorés.
const meter = otelApi.getMeter('trustpass');

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'trustpass_' });

// --- Signaux techniques ------------------------------------------------------
const httpDuration = new client.Histogram({
  name: 'trustpass_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP par route',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3, 5],
  registers: [registry],
});
const httpTotal = new client.Counter({
  name: 'trustpass_http_requests_total',
  help: 'Nombre de requêtes HTTP',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

// --- Compteurs métier : double émission Prometheus (/metrics) + OTel (App Insights)
// Les points d'usage appellent les helpers record* ci-dessous, qui alimentent
// les deux backends d'un seul geste.
const promCheckout = new client.Counter({
  name: 'trustpass_checkout_total',
  help: 'Résultat du tunnel d’achat',
  labelNames: ['result'] as const, // success | failed
  registers: [registry],
});
const promWebhook = new client.Counter({
  name: 'trustpass_webhook_events_total',
  help: 'Traitement des webhooks Stripe',
  labelNames: ['result'] as const, // ok | error | replayed
  registers: [registry],
});
const promEmail = new client.Counter({
  name: 'trustpass_email_send_total',
  help: 'Résultat des envois de courriels',
  labelNames: ['result'] as const, // ok | error
  registers: [registry],
});
const promTransferDelay = new client.Histogram({
  name: 'trustpass_transfer_delay_seconds',
  help: 'Délai entre paiement confirmé et billet transféré',
  buckets: [0.2, 0.5, 1, 2, 3, 5, 10, 30],
  registers: [registry],
});

const otelCheckout = meter.createCounter('trustpass_checkout_total', { description: 'Résultat du tunnel d’achat' });
const otelWebhook = meter.createCounter('trustpass_webhook_events_total', { description: 'Traitement des webhooks Stripe' });
const otelEmail = meter.createCounter('trustpass_email_send_total', { description: 'Résultat des envois de courriels' });
const otelTransferDelay = meter.createHistogram('trustpass_transfer_delay_seconds', { description: 'Délai paiement → billet', unit: 's' });

export function recordCheckout(result: 'success' | 'failed'): void {
  promCheckout.inc({ result });
  otelCheckout.add(1, { result });
}
export function recordWebhook(result: 'ok' | 'error' | 'replayed'): void {
  promWebhook.inc({ result });
  otelWebhook.add(1, { result });
}
export function recordEmail(result: 'ok' | 'error'): void {
  promEmail.inc({ result });
  otelEmail.add(1, { result });
}
export function recordTransferDelay(seconds: number): void {
  promTransferDelay.observe(seconds);
  otelTransferDelay.record(seconds);
}

// --- Jauges métier (calculées à la lecture, résilientes) ---------------------
function safeGauge(name: string, help: string, compute: () => Promise<number>) {
  return new client.Gauge({
    name,
    help,
    registers: [registry],
    async collect() {
      if (env.NODE_ENV === 'test') return; // pas d'accès DB/Redis en tests unitaires
      try {
        this.set(await compute());
      } catch {
        /* la sonde ne doit jamais faire échouer /metrics */
      }
    },
  });
}

const computeOrphanOrders = () =>
  prisma.order.count({ where: { status: 'paid', transfer: { is: null } } });
const computeStaleReservations = () =>
  prisma.listing.count({ where: { status: 'reserved', reservedUntil: { lt: new Date() } } });

// Prometheus (/metrics)
safeGauge('trustpass_orders_paid_not_transferred', 'Commandes payées sans transfert de billet', computeOrphanOrders);
safeGauge('trustpass_stale_reservations', 'Réservations expirées non libérées', computeStaleReservations);

// OpenTelemetry → App Insights (observable gauges, mêmes fonctions de calcul)
function observe(name: string, description: string, compute: () => Promise<number>) {
  meter.createObservableGauge(name, { description }).addCallback(async (r) => {
    if (env.NODE_ENV === 'test') return;
    try {
      r.observe(await compute());
    } catch {
      /* résilient */
    }
  });
}
observe('trustpass_orders_paid_not_transferred', 'Commandes payées sans transfert de billet', computeOrphanOrders);
observe('trustpass_stale_reservations', 'Réservations expirées non libérées', computeStaleReservations);

const queueDepth = new client.Gauge({
  name: 'trustpass_queue_depth',
  help: 'Profondeur de la file',
  labelNames: ['queue'] as const,
  registers: [registry],
});
// Jauge auto-enregistrée (registers) ; la référence n'a pas besoin d'être conservée.
const _queueOldest = new client.Gauge({
  name: 'trustpass_queue_oldest_job_seconds',
  help: 'Âge de la plus ancienne tâche en attente',
  labelNames: ['queue'] as const,
  registers: [registry],
  async collect() {
    if (env.NODE_ENV === 'test') return;
    try {
      const q = getNotificationsQueue();
      if (!q) return;
      const counts = await q.getJobCounts('wait', 'delayed');
      queueDepth.set({ queue: 'emails' }, (counts.wait ?? 0) + (counts.delayed ?? 0));
      const [oldest] = await q.getJobs(['wait', 'delayed'], 0, 0, true);
      const ageSec = oldest ? (Date.now() - oldest.timestamp) / 1000 : 0;
      this.set({ queue: 'emails' }, ageSec);
    } catch {
      /* résilient */
    }
  },
});

// --- Middleware : mesure latence + trafic par route --------------------------
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = (req.baseUrl || '') + (req.route?.path ?? req.path ?? 'unknown');
    const labels = { method: req.method, route, status: String(res.statusCode) };
    end(labels);
    httpTotal.inc(labels);
  });
  next();
}
