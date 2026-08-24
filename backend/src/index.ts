import './lib/otel.js'; // DOIT rester en premier (auto-instrumentation OpenTelemetry)
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startReservationReaper } from './workers/reservationReaper.js';
import { startNotificationsWorker } from './modules/notifications/notifications.worker.js';
import { startTransferWorker } from './modules/transfer/transfer.worker.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`TrustPass API listening on :${env.PORT}`);
});

// Filet de sécurité : libère les réservations expirées côté DB (le TTL Redis expire seul).
startReservationReaper();

// Worker d'emails transactionnels (Resend). Consomme la queue BullMQ.
startNotificationsWorker();

// Worker de transfert : exécute le transfert atomique délégué par le webhook Stripe
// (découplé de la réponse HTTP — correctif AN-2026-017).
startTransferWorker();
