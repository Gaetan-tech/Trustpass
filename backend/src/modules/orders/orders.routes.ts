import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ordersController } from './orders.controller.js';

// Rate limit par utilisateur : anti-spam de réservations pendant un drop (API_CONTRACT).
const orderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30 });

export const ordersRoutes = Router();

ordersRoutes.post('/', authenticate, orderLimiter, asyncHandler(ordersController.create));
ordersRoutes.post('/:id/finalize', authenticate, asyncHandler(ordersController.finalize));
// Démo/dev uniquement : simule un paiement réussi (le service refuse si Stripe est actif).
ordersRoutes.post('/:id/simulate-pay', authenticate, orderLimiter, asyncHandler(ordersController.simulatePay));
ordersRoutes.get('/mine', authenticate, asyncHandler(ordersController.mine));
ordersRoutes.get('/:id', authenticate, asyncHandler(ordersController.getById));
