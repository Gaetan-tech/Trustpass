import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { webhooksController } from './webhooks.controller.js';

// Voir API_CONTRACT.md §webhooks/stripe — SOURCE DE VÉRITÉ du paiement (US-4.3).
// Le corps est lu en RAW (voir app.ts) pour vérifier la signature Stripe.
export const webhooksRoutes = Router();

webhooksRoutes.post('/stripe', asyncHandler(webhooksController.stripe));
