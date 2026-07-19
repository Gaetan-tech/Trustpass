import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from '../../lib/stripe.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { handleStripeEvent } from './webhooks.service.js';

export const webhooksController = {
  // POST /webhooks/stripe — req.body est un Buffer (raw), monté dans app.ts.
  async stripe(req: Request, res: Response) {
    let event: Stripe.Event;

    if (stripe && env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.header('Stripe-Signature');
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig ?? '', env.STRIPE_WEBHOOK_SECRET);
      } catch {
        throw new AppError(400, 'INVALID_SIGNATURE', 'Signature Stripe invalide');
      }
    } else {
      // Mode DEV (sans clé) : on parse directement le corps simulé.
      event = JSON.parse((req.body as Buffer).toString('utf8')) as Stripe.Event;
    }

    await handleStripeEvent(event);
    res.status(200).json({ received: true });
  },
};
