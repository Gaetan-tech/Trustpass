import { redis } from '../../lib/redis.js';
import { env } from '../../config/env.js';

const key = (listingId: string) => `listing:reserved:${listingId}`;

// Verrou de réservation anti double-vente (ADR-002). SET NX EX : pose le verrou
// uniquement s'il n'existe pas déjà. Retourne false si un autre acheteur le détient.
export async function acquireReservation(listingId: string, buyerId: string): Promise<boolean> {
  const res = await redis.set(key(listingId), buyerId, 'EX', env.RESERVATION_TTL_SECONDS, 'NX');
  return res === 'OK';
}

// Libère le verrou seulement s'il appartient bien à ce buyer (compare-and-delete).
export async function releaseReservation(listingId: string, buyerId: string): Promise<void> {
  const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
  await redis.eval(lua, 1, key(listingId), buyerId);
}

export function reservationExpiry(): Date {
  return new Date(Date.now() + env.RESERVATION_TTL_SECONDS * 1000);
}
