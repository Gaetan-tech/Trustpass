import { prisma } from '../../lib/prisma.js';
import { generateQr, generateReference } from '../../lib/qr.js';
import { writeAudit } from '../../lib/audit.js';
import { releaseReservation } from '../orders/reservation.js';
import { enqueueEmail } from '../notifications/notifications.service.js';

// Transfert de propriété atomique après paiement confirmé (US-5.1).
// Invariant (ADR-002/003) : tout se fait dans UNE transaction, ou rien.
// Idempotent : si un transfert existe déjà pour la commande, on ne refait rien.
export async function executeTransfer(orderId: string): Promise<void> {
  // La transaction renvoie de quoi notifier, ou null si déjà traité (anti-doublon email).
  const notify = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { listing: { include: { ticket: { include: { event: true } } } }, transfer: true },
    });

    if (order.transfer || order.status === 'transferred') return null; // déjà traité

    const ticket = order.listing.ticket;
    const oldQr = ticket.qrCode;
    const newQr = generateQr(ticket.id, ticket.qrVersion + 1);

    // 1) Rotation du QR + changement de propriétaire (invalide l'ancien QR).
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        ownerId: order.buyerId,
        status: 'owned',
        qrCode: newQr,
        qrVersion: { increment: 1 },
        reference: generateReference(), // nouvelle référence à chaque transfert
      },
    });

    // 2) Annonce vendue, commande transférée.
    await tx.listing.update({ where: { id: order.listingId }, data: { status: 'sold' } });
    await tx.order.update({ where: { id: order.id }, data: { status: 'transferred' } });

    // 3) Trace immuable du transfert.
    await tx.transfer.create({
      data: {
        kind: 'purchase',
        orderId: order.id,
        ticketId: ticket.id,
        fromUserId: order.sellerId,
        toUserId: order.buyerId,
        oldQrCode: oldQr,
        newQrCode: newQr,
      },
    });

    await writeAudit(
      { action: 'ownership_transfer', targetType: 'ticket', targetId: ticket.id, amount: order.amount, metadata: { orderId: order.id } },
      tx,
    );
    await writeAudit({ action: 'qr_invalidate', targetType: 'ticket', targetId: ticket.id, metadata: { oldQr } }, tx);

    // Libère le verrou Redis (best-effort, hors chemin critique de cohérence).
    await releaseReservation(order.listingId, order.buyerId).catch(() => undefined);

    return {
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      amount: order.amount,
      eventName: ticket.event.name,
    };
  });

  if (!notify) return;

  // Emails transactionnels (hors transaction, best-effort).
  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({ where: { id: notify.buyerId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: notify.sellerId }, select: { email: true } }),
  ]);
  if (buyer) await enqueueEmail({ type: 'purchase_confirmed', to: buyer.email, eventName: notify.eventName });
  if (seller) await enqueueEmail({ type: 'listing_sold', to: seller.email, eventName: notify.eventName, amount: notify.amount });
}
