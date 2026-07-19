import { getNotificationsQueue } from '../../lib/queue.js';

// Jobs d'email transactionnel (US-9.1). Le payload reste minimal : le worker
// construit le contenu. Les emails ne bloquent jamais le tunnel (asynchrone).
export type EmailJob =
  | { type: 'email_verification'; to: string }
  | { type: 'listing_sold'; to: string; eventName: string; amount: number }
  | { type: 'purchase_confirmed'; to: string; eventName: string }
  | { type: 'payment_failed'; to: string; eventName: string }
  | { type: 'ticket_received'; to: string; eventName: string; holderName: string; reference: string; hasAccount: boolean };

// Enfile un email. No-op en test (queue absente). Ne jette jamais côté appelant.
export async function enqueueEmail(job: EmailJob): Promise<void> {
  const queue = getNotificationsQueue();
  if (!queue) return;
  await queue
    .add('email', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    })
    .catch(() => undefined);
}
