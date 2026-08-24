import { Worker } from 'bullmq';
import { TRANSFER_QUEUE, queueConnection } from '../../lib/queue.js';
import { logger } from '../../lib/logger.js';
import { executeTransfer } from './transfer.service.js';
import { checkoutTotal, transferDelay } from '../../lib/metrics.js';

export interface TransferJob {
  orderId: string;
  paidAt?: number; // horodatage du paiement (pour mesurer le délai paiement → billet)
}

// Consomme la file des transferts : exécute le transfert atomique hors du thread
// de réponse du webhook (BLOC 4, §4.2). executeTransfer est idempotent, et le
// jobId = orderId empêche tout doublon si Stripe rejoue l'événement.
export function startTransferWorker(): Worker<TransferJob> {
  const worker = new Worker<TransferJob>(
    TRANSFER_QUEUE,
    async (job) => {
      await executeTransfer(job.data.orderId); // atomique + idempotent
      if (job.data.paidAt) transferDelay.observe((Date.now() - job.data.paidAt) / 1000);
      checkoutTotal.inc({ result: 'success' });
    },
    { connection: queueConnection() },
  );
  worker.on('failed', (job, err) => {
    checkoutTotal.inc({ result: 'failed' });
    logger.error({ jobId: job?.id, orderId: job?.data.orderId, err }, 'transfer job failed');
  });
  return worker;
}
