import Stripe from 'stripe';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Feature flag : le paiement Stripe réel n'est actif que si le flag est activé
// ET qu'une clé secrète valide est fournie. C'est ce qui permet de livrer la
// fonctionnalité en prod tout en la laissant invisible tant qu'on ne l'active pas.
// Sinon (flag OFF ou clé absente) → mode simulé (PaymentIntent factices).
const hasSecretKey = env.STRIPE_SECRET_KEY.startsWith('sk_');
export const stripeEnabled = env.FEATURE_STRIPE_CHECKOUT && hasSecretKey;

if (env.FEATURE_STRIPE_CHECKOUT && !hasSecretKey) {
  // Garde-fou : flag activé sans clé → on reste en mode simulé plutôt que de casser
  // le tunnel d'achat. À corriger en fournissant STRIPE_SECRET_KEY (sk_...).
  logger.warn(
    'FEATURE_STRIPE_CHECKOUT est activé mais STRIPE_SECRET_KEY est absente/invalide — le paiement reste en mode simulé.',
  );
}

// Pas d'apiVersion figée ici : on laisse la version par défaut du compte pour
// éviter un couplage fort avec la version des types @types/stripe.
export const stripe = stripeEnabled ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
}

// Crée un PaymentIntent (ou un intent factice en dev). `amount` en centimes.
export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  orderId: string;
  sellerStripeAccountId?: string | null;
  commission: number;
}): Promise<PaymentIntentResult> {
  if (!stripe) {
    const id = `pi_fake_${crypto.randomUUID()}`;
    return { id, clientSecret: `${id}_secret_dev` };
  }

  const intent = await stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency.toLowerCase(),
    metadata: { orderId: params.orderId },
    // Stripe Connect : reversement au vendeur - commission plateforme.
    ...(params.sellerStripeAccountId
      ? {
          application_fee_amount: params.commission,
          transfer_data: { destination: params.sellerStripeAccountId },
        }
      : {}),
  });
  return { id: intent.id, clientSecret: intent.client_secret ?? '' };
}

export interface CheckoutSessionResult {
  id: string;
  url: string | null;
}

// Crée une session Stripe Checkout (page de paiement hébergée). L'utilisateur y est
// redirigé, paie (carte test 4242…), puis revient sur successUrl.
export async function createCheckoutSession(params: {
  amount: number;
  currency: string;
  orderId: string;
  eventName: string;
  successUrl: string;
  cancelUrl: string;
  sellerStripeAccountId?: string | null;
  commission: number;
}): Promise<CheckoutSessionResult | null> {
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.amount,
          product_data: { name: `Billet — ${params.eventName}` },
        },
      },
    ],
    metadata: { orderId: params.orderId },
    // metadata sur le PaymentIntent → réutilisé par le webhook payment_intent.succeeded.
    payment_intent_data: {
      metadata: { orderId: params.orderId },
      ...(params.sellerStripeAccountId
        ? {
            application_fee_amount: params.commission,
            transfer_data: { destination: params.sellerStripeAccountId },
          }
        : {}),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
  return { id: session.id, url: session.url };
}

// Récupère l'état de paiement d'une session (pour confirmer au retour, sans dépendre
// d'un webhook — pratique en local sans `stripe listen`).
export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<{ paid: boolean } | null> {
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return { paid: session.payment_status === 'paid' };
}
