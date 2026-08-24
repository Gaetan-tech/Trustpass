// Métriques d'exploitation au format Prometheus — TrustPass (BLOC 4, §3.2.2).
// Exposées par GET /api/v1/metrics (prom-client). Combine les signaux dorés
// (latence, trafic, erreurs, saturation) et des compteurs métier propres au
// produit, seuls capables de révéler certaines pannes silencieuses.
import client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';
import { getNotificationsQueue } from './queue.js';
import { env } from '../config/env.js';

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

// --- Compteurs métier (incrémentés aux points d'usage) -----------------------
export const checkoutTotal = new client.Counter({
  name: 'trustpass_checkout_total',
  help: 'Résultat du tunnel d’achat',
  labelNames: ['result'] as const, // success | failed
  registers: [registry],
});
export const webhookEventsTotal = new client.Counter({
  name: 'trustpass_webhook_events_total',
  help: 'Traitement des webhooks Stripe',
  labelNames: ['result'] as const, // ok | error | replayed
  registers: [registry],
});
export const emailSendTotal = new client.Counter({
  name: 'trustpass_email_send_total',
  help: 'Résultat des envois de courriels',
  labelNames: ['result'] as const, // ok | error
  registers: [registry],
});
export const transferDelay = new client.Histogram({
  name: 'trustpass_transfer_delay_seconds',
  help: 'Délai entre paiement confirmé et billet transféré',
  buckets: [0.2, 0.5, 1, 2, 3, 5, 10, 30],
  registers: [registry],
});

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

safeGauge(
  'trustpass_orders_paid_not_transferred',
  'Commandes payées sans transfert de billet',
  () => prisma.order.count({ where: { status: 'paid', transfer: { is: null } } }),
);
safeGauge(
  'trustpass_stale_reservations',
  'Réservations expirées non libérées',
  () => prisma.listing.count({ where: { status: 'reserved', reservedUntil: { lt: new Date() } } }),
);

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
