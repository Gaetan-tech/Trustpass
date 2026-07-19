import { prisma } from '../lib/prisma.js';
import { writeAudit } from '../lib/audit.js';
import { releaseReservation } from '../modules/orders/reservation.js';
import { logger } from '../lib/logger.js';

// Remet en vente les annonces dont la réservation a expiré (TTL Redis dépassé),
// mais restées "reserved" en base (US-4.1 / ADR-002). Filet de sécurité côté DB.
export async function expireStaleReservations(now = new Date()): Promise<number> {
  const stale = await prisma.listing.findMany({
    where: { status: 'reserved', reservedUntil: { lt: now } },
    select: { id: true, ticketId: true, reservedBy: true },
  });

  for (const listing of stale) {
    await prisma.$transaction(async (tx) => {
      // Course possible : ne libère que si toujours "reserved".
      const fresh = await tx.listing.findUnique({ where: { id: listing.id } });
      if (!fresh || fresh.status !== 'reserved') return;

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: 'active', reservedBy: null, reservedUntil: null },
      });
      await tx.ticket.update({ where: { id: listing.ticketId }, data: { status: 'listed' } });
      await tx.order.updateMany({
        where: { listingId: listing.id, status: 'pending' },
        data: { status: 'failed' },
      });
      await writeAudit(
        { action: 'reservation_expire', targetType: 'listing', targetId: listing.id },
        tx,
      );
    });
    if (listing.reservedBy) {
      await releaseReservation(listing.id, listing.reservedBy).catch(() => undefined);
    }
  }

  if (stale.length) logger.info({ count: stale.length }, 'Réservations expirées libérées');
  return stale.length;
}

// Démarre le reaper à intervalle régulier. Renvoie un handle pour l'arrêter.
export function startReservationReaper(intervalMs = 30_000): NodeJS.Timeout {
  return setInterval(() => {
    expireStaleReservations().catch((err) => logger.error({ err }, 'reservationReaper a échoué'));
  }, intervalMs).unref();
}
