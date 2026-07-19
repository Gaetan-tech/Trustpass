import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ticketsController } from './tickets.controller.js';

// Voir API_CONTRACT.md §Billets et §Contrôle d'accès.
export const ticketsRoutes = Router();

ticketsRoutes.get('/me', authenticate, asyncHandler(ticketsController.mine));
ticketsRoutes.post('/attach', authenticate, asyncHandler(ticketsController.attach));
ticketsRoutes.post(
  '/validate',
  authenticate,
  requireRole('controller'),
  asyncHandler(ticketsController.validate),
);
ticketsRoutes.get('/:id', authenticate, asyncHandler(ticketsController.getById));
ticketsRoutes.post('/:id/transfer', authenticate, asyncHandler(ticketsController.transfer));
