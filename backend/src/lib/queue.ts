import { Queue, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';

export const NOTIFICATIONS_QUEUE = 'notifications';

// Options de connexion BullMQ dérivées de REDIS_URL. On passe un objet d'options
// (et non une instance ioredis) pour éviter le conflit de versions ioredis de BullMQ.
export function queueConnection(): ConnectionOptions {
  const u = new URL(env.REDIS_URL);
  // `rediss://` (ex. Azure Cache for Redis) impose TLS. ioredis l'active
  // automatiquement à partir du schéma, mais BullMQ reçoit ici un objet
  // d'options : on doit donc activer `tls` explicitement.
  const isTls = u.protocol === 'rediss:';
  return {
    host: u.hostname,
    port: Number(u.port || (isTls ? 6380 : 6379)),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    tls: isTls ? { servername: u.hostname } : undefined,
    maxRetriesPerRequest: null, // requis par BullMQ
  };
}

let queue: Queue | null = null;

// Queue lazy. En test, on renvoie null pour ne pas ouvrir de connexion Redis.
export function getNotificationsQueue(): Queue | null {
  if (env.NODE_ENV === 'test') return null;
  if (!queue) {
    queue = new Queue(NOTIFICATIONS_QUEUE, { connection: queueConnection() });
  }
  return queue;
}
