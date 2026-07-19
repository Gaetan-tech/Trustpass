import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import {
  createPaymentIntent,
  createCheckoutSession,
  retrieveCheckoutSession,
  stripeEnabled,
} from '../../lib/stripe.js';
import { executeTransfer } from '../transfer/transfer.service.js';
import { resolveRule, assertWindowOpen } from '../rules/rules.service.js';
import { acquireReservation, releaseReservation, reservationExpiry } from './reservation.js';

interface CreateOrderResult {
  orderId: string;
  clientSecret: string | null;
  checkoutUrl: string | null;
  reservedUntil: Date | null;
  idempotentReplay?: boolean;
}

export const ordersService = {
  // US-4.1/4.2 — réserve l'annonce (verrou Redis) puis crée l'intent de paiement.
  async create(buyerId: string, listingId: string, idempotencyKey: string): Promise<CreateOrderResult> {
    // Idempotence : une même clé ne crée jamais deux commandes / débits.
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return { orderId: existing.id, clientSecret: null, checkoutUrl: null, reservedUntil: null, idempotentReplay: true };
    }

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { ticket: { include: { event: true } } },
    });
    if (!listing || listing.status === 'withdrawn' || listing.status === 'sold') {
      throw Errors.conflict('LISTING_NOT_AVAILABLE', 'Annonce indisponible');
    }
    if (listing.status !== 'active') {
      throw Errors.conflict('LISTING_RESERVED', 'Annonce déjà réservée');
    }

    const rule = await resolveRule(listing.ticket.event, listing.ticket.ticketTypeId);
    assertWindowOpen(rule);

    // Verrou de concurrence : premier arrivé, premier servi (anti double-vente).
    const locked = await acquireReservation(listingId, buyerId);
    if (!locked) throw Errors.conflict('LISTING_RESERVED', 'Annonce déjà réservée');

    const commission = Math.round((listing.price * rule.commissionBps) / 10000);
    const reservedUntil = reservationExpiry();

    let orderId: string;
    try {
      orderId = await prisma.$transaction(async (tx) => {
        // Re-vérifie l'état sous transaction (garde-fou contre les courses).
        const fresh = await tx.listing.findUniqueOrThrow({ where: { id: listingId } });
        if (fresh.status !== 'active') {
          throw Errors.conflict('LISTING_NOT_AVAILABLE', 'Annonce indisponible');
        }
        await tx.listing.update({
          where: { id: listingId },
          data: { status: 'reserved', reservedBy: buyerId, reservedUntil },
        });
        await tx.ticket.update({ where: { id: listing.ticketId }, data: { status: 'reserved' } });
        const order = await tx.order.create({
          data: {
            listingId,
            buyerId,
            sellerId: listing.sellerId,
            amount: listing.price,
            commission,
            currency: 'EUR',
            status: 'pending',
            idempotencyKey,
          },
        });
        await writeAudit(
          { actorId: buyerId, action: 'reservation_create', targetType: 'listing', targetId: listingId, amount: listing.price },
          tx,
        );
        return order.id;
      });
    } catch (err) {
      await releaseReservation(listingId, buyerId);
      throw err;
    }

    // Paiement Stripe (hors transaction DB). En cas d'échec : rollback réservation.
    try {
      const seller = await prisma.user.findUniqueOrThrow({ where: { id: listing.sellerId } });

      // Stripe configuré → session Checkout hébergée (redirection). Sinon → mode simulé.
      if (stripeEnabled) {
        const session = await createCheckoutSession({
          amount: listing.price,
          currency: 'EUR',
          orderId,
          commission,
          eventName: listing.ticket.event.name,
          sellerStripeAccountId: seller.stripeAccountId,
          successUrl: `${env.CORS_ORIGIN}/tickets?purchased=${orderId}`,
          cancelUrl: `${env.CORS_ORIGIN}/?canceled=1`,
        });
        // On stocke l'id de session pour pouvoir confirmer au retour.
        await prisma.order.update({ where: { id: orderId }, data: { stripePaymentIntentId: session?.id } });
        return { orderId, clientSecret: null, checkoutUrl: session?.url ?? null, reservedUntil };
      }

      const intent = await createPaymentIntent({
        amount: listing.price,
        currency: 'EUR',
        orderId,
        commission,
        sellerStripeAccountId: seller.stripeAccountId,
      });
      await prisma.order.update({ where: { id: orderId }, data: { stripePaymentIntentId: intent.id } });
      return { orderId, clientSecret: intent.clientSecret, checkoutUrl: null, reservedUntil };
    } catch (err) {
      await ordersService.releaseOrder(orderId, 'failed').catch(() => undefined);
      throw err;
    }
  },

  // Confirme un paiement au retour de Stripe Checkout (sans dépendre d'un webhook).
  // Vérifie l'état réel de la session côté Stripe, puis déclenche le transfert (idempotent).
  async finalize(buyerId: string, orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { transfer: true } });
    if (!order || order.buyerId !== buyerId) throw Errors.notFound('Commande introuvable');

    if (order.status !== 'transferred' && stripeEnabled && order.stripePaymentIntentId) {
      const session = await retrieveCheckoutSession(order.stripePaymentIntentId).catch(() => null);
      if (session?.paid) {
        await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } }).catch(() => undefined);
        await writeAudit({ action: 'payment_succeeded', targetType: 'order', targetId: orderId });
        await executeTransfer(orderId); // atomique + idempotent
      }
    }
    return ordersService.getForBuyer(buyerId, orderId);
  },

  // Mode démo uniquement (Stripe non configuré) : simule un paiement réussi.
  // Remplace le webhook `payment_intent.succeeded` qu'enverrait Stripe en prod.
  // Refusé si un vrai Stripe est branché (on ne bypass jamais un paiement réel).
  async simulatePayment(buyerId: string, orderId: string) {
    if (stripeEnabled) {
      throw Errors.conflict('STRIPE_ENABLED', 'Simulation indisponible : Stripe est configuré');
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.buyerId !== buyerId) throw Errors.notFound('Commande introuvable');

    // Idempotent : si déjà transféré, on ne rejoue rien (executeTransfer est un no-op).
    if (order.status === 'pending' || order.status === 'paid') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } }).catch(() => undefined);
      await writeAudit({ action: 'payment_succeeded', targetType: 'order', targetId: orderId, metadata: { simulated: true } });
      await executeTransfer(orderId); // atomique + idempotent
    }
    return ordersService.getForBuyer(buyerId, orderId);
  },

  // Libère une commande : annonce/billet redeviennent disponibles, verrou levé.
  async releaseOrder(orderId: string, status: 'failed' | 'refunded') {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { listing: true } });
    if (!order) return;
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status } });
      await tx.listing.update({
        where: { id: order.listingId },
        data: { status: 'active', reservedBy: null, reservedUntil: null },
      });
      await tx.ticket.update({ where: { id: order.listing.ticketId }, data: { status: 'listed' } });
    });
    await releaseReservation(order.listingId, order.buyerId).catch(() => undefined);
  },

  async getForBuyer(buyerId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { transfer: true },
    });
    if (!order || order.buyerId !== buyerId) throw Errors.notFound('Commande introuvable');
    return {
      id: order.id,
      status: order.status,
      amount: order.amount,
      ticketId: order.transfer?.ticketId,
      newQr: order.transfer?.newQrCode,
    };
  },

  async listMine(buyerId: string) {
    const rows = await prisma.order.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: { transfer: true },
    });
    return { data: rows.map((o) => ({ id: o.id, status: o.status, amount: o.amount })) };
  },
};
