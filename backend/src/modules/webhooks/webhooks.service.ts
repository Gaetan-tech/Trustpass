import type Stripe from 'stripe';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import { executeTransfer } from '../transfer/transfer.service.js';
import { ordersService } from '../orders/orders.service.js';
import { enqueueEmail } from '../notifications/notifications.service.js';
import { getTransferQueue } from '../../lib/queue.js';
import { recordWebhook, recordCheckout } from '../../lib/metrics.js';

// Traite un événement Stripe de façon idempotente (US-4.3).
// stripe_events garantit qu'un même évènement n'est traité qu'une fois.
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (seen?.processedAt) {
    recordWebhook('replayed');
    return; // déjà traité
  }

  await prisma.stripeEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, type: event.type },
    update: {},
  });

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const orderId = orderIdFrom(event);
      if (orderId) {
        await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } }).catch(() => undefined);
        await writeAudit({ action: 'payment_succeeded', targetType: 'order', targetId: orderId });
        // On accuse réception immédiatement : le transfert (atomique, ~1,2 s) est
        // délégué à un worker BullMQ pour ne pas saturer le pool sous charge
        // (correctif AN-2026-017). En test (pas de file), transfert synchrone.
        const queue = getTransferQueue();
        if (queue) {
          await queue.add(
            'transfer',
            { orderId, paidAt: Date.now() },
            { jobId: orderId, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
          );
        } else {
          await executeTransfer(orderId);
          recordCheckout('success');
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const orderId = orderIdFrom(event);
      if (orderId) {
        await writeAudit({ action: 'payment_failed', targetType: 'order', targetId: orderId });
        await ordersService.releaseOrder(orderId, 'failed'); // rollback : annonce redevient active
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { buyer: { select: { email: true } }, listing: { include: { ticket: { include: { event: true } } } } },
        });
        if (order) {
          await enqueueEmail({ type: 'payment_failed', to: order.buyer.email, eventName: order.listing.ticket.event.name });
        }
        recordCheckout('failed');
      }
      break;
    }
    default:
      logger.debug({ type: event.type }, 'Stripe event ignoré');
  }

  await prisma.stripeEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  recordWebhook('ok');
}

function orderIdFrom(event: Stripe.Event): string | undefined {
  const intent = event.data.object as Stripe.PaymentIntent;
  return intent.metadata?.orderId;
}
