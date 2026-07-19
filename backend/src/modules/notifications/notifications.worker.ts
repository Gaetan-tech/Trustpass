import { Worker } from 'bullmq';
import { Resend } from 'resend';
import { NOTIFICATIONS_QUEUE, queueConnection } from '../../lib/queue.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { EmailJob } from './notifications.service.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function render(job: EmailJob): { subject: string; html: string } {
  switch (job.type) {
    case 'email_verification':
      return { subject: 'Vérifiez votre compte TrustPass', html: '<p>Bienvenue ! Confirmez votre adresse email.</p>' };
    case 'listing_sold':
      return { subject: 'Votre billet a été vendu', html: `<p>Votre billet pour « ${job.eventName} » a été vendu (${(job.amount / 100).toFixed(2)} €).</p>` };
    case 'purchase_confirmed':
      return { subject: 'Achat confirmé', html: `<p>Votre achat pour « ${job.eventName} » est confirmé. Votre nouveau billet est disponible.</p>` };
    case 'payment_failed':
      return { subject: 'Paiement échoué', html: `<p>Le paiement pour « ${job.eventName} » a échoué. L’annonce a été relibérée.</p>` };
    case 'ticket_received':
      return {
        subject: `Vous avez reçu un billet pour « ${job.eventName} »`,
        html: `<p>Bonjour ${job.holderName},</p>
<p>Un billet pour <strong>« ${job.eventName} »</strong> vous a été transféré sur TrustPass.</p>
<p>Numéro de référence du billet : <strong>${job.reference}</strong>.</p>
${
  job.hasAccount
    ? '<p>Il est dès maintenant disponible dans « Mes billets » de votre compte TrustPass.</p>'
    : '<p>Créez un compte TrustPass avec cette adresse email pour récupérer votre billet.</p>'
}`,
      };
  }
}

async function process(job: EmailJob): Promise<void> {
  const { subject, html } = render(job);
  if (!resend) {
    logger.info({ to: job.to, subject }, '[email:dev] envoi simulé');
    return;
  }
  // Le SDK Resend ne jette pas sur erreur API : on inspecte la réponse.
  const { data, error } = await resend.emails.send({ from: env.EMAIL_FROM, to: job.to, subject, html });
  if (error) {
    logger.error({ to: job.to, subject, error }, 'email Resend échoué');
    throw new Error(`Resend: ${error.message ?? 'envoi échoué'}`);
  }
  logger.info({ to: job.to, subject, id: data?.id }, 'email envoyé (Resend)');
}

// Démarre le worker BullMQ. À lancer dans le process serveur (index.ts).
export function startNotificationsWorker(): Worker {
  const worker = new Worker<EmailJob>(
    NOTIFICATIONS_QUEUE,
    async (job) => process(job.data),
    { connection: queueConnection() },
  );
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'email job failed'));
  return worker;
}
