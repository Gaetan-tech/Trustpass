// Sondes de santé — TrustPass (BLOC 4, §3.2.4).
// /live ne dépend que du processus (jamais des dépendances, sous peine de
// redémarrages en cascade) ; /ready interroge les dépendances avec un délai
// borné pour ne jamais devenir elle-même une source de blocage.
import { readFileSync } from 'node:fs';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { getNotificationsQueue } from '../../lib/queue.js';
import { registry } from '../../lib/metrics.js';

const startedAt = Date.now();

function appVersion(): string {
  for (const p of ['../../../package.json', '../../package.json']) {
    try {
      return JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')).version;
    } catch {
      /* on tente le chemin suivant */
    }
  }
  return process.env.npm_package_version ?? 'dev';
}
const VERSION = appVersion();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
const state = (r: PromiseSettledResult<unknown>) => (r.status === 'fulfilled' ? 'up' : 'down');

// GET /live — le processus tourne (aucune dépendance interrogée).
export function live(_req: Request, res: Response) {
  res.status(200).json({ status: 'alive' });
}

// GET /ready — le réplica peut accepter du trafic.
export async function ready(_req: Request, res: Response) {
  const queue = getNotificationsQueue();
  const checks = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 800), // base de données
    withTimeout(redis.ping(), 500), // cache et verrous
    queue ? withTimeout(queue.waitUntilReady(), 500) : Promise.resolve(), // file BullMQ
  ]);
  const details = { database: state(checks[0]), redis: state(checks[1]), queue: state(checks[2]) };
  const ok = Object.values(details).every((s) => s === 'up');
  res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'degraded', details });
}

// GET /health — état détaillé et lisible (agrégat + version + durée de fonctionnement).
export async function health(_req: Request, res: Response) {
  const checks = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 800),
    withTimeout(redis.ping(), 500),
  ]);
  const details = { database: state(checks[0]), redis: state(checks[1]) };
  const ok = Object.values(details).every((s) => s === 'up');
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    details,
  });
}

// GET /metrics — exposition Prometheus.
export async function metrics(_req: Request, res: Response) {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}
