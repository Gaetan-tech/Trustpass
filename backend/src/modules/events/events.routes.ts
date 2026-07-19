import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { eventsController } from './events.controller.js';

// Voir API_CONTRACT.md §Events & règles organisateur.
export const eventsRoutes = Router();

eventsRoutes.get('/', asyncHandler(eventsController.list));
eventsRoutes.get('/:id', asyncHandler(eventsController.getById));
eventsRoutes.get('/:id/rules', asyncHandler(eventsController.getRules));
eventsRoutes.post('/', authenticate, requireRole('organizer'), asyncHandler(eventsController.create));
eventsRoutes.put(
  '/:id/rules',
  authenticate,
  requireRole('organizer'),
  asyncHandler(eventsController.upsertRule),
);
eventsRoutes.put('/:id', authenticate, requireRole('organizer'), asyncHandler(eventsController.update));
eventsRoutes.delete('/:id', authenticate, requireRole('organizer'), asyncHandler(eventsController.remove));
