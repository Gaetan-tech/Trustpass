import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { organizerService } from './organizer.service.js';

// Voir API_CONTRACT.md §Dashboard organisateur (US-8.1).
export const organizerRoutes = Router();

organizerRoutes.use(authenticate, requireRole('organizer'));

organizerRoutes.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await organizerService.listEvents(req.user!.id));
  }),
);

organizerRoutes.get(
  '/events/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await organizerService.stats(req.user!.id, req.params.id!));
  }),
);

organizerRoutes.get(
  '/events/:id/tickets',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await organizerService.listEventTickets(req.user!.id, req.params.id!));
  }),
);

organizerRoutes.get(
  '/tickets/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await organizerService.ticketHistory(req.user!.id, req.params.id!));
  }),
);
