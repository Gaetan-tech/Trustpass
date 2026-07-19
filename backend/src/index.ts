import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startReservationReaper } from './workers/reservationReaper.js';
import { startNotificationsWorker } from './modules/notifications/notifications.worker.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`TrustPass API listening on :${env.PORT}`);
});

// Filet de sécurité : libère les réservations expirées côté DB (le TTL Redis expire seul).
startReservationReaper();

// Worker d'emails transactionnels (Resend). Consomme la queue BullMQ.
startNotificationsWorker();
