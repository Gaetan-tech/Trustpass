import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { listingsController } from './listings.controller.js';

// Voir API_CONTRACT.md §Annonces / marketplace.
export const listingsRoutes = Router();

listingsRoutes.get('/', asyncHandler(listingsController.list));
listingsRoutes.get('/mine', authenticate, asyncHandler(listingsController.mine));
listingsRoutes.get('/:id', asyncHandler(listingsController.getById));
listingsRoutes.post('/', authenticate, asyncHandler(listingsController.create));
listingsRoutes.delete('/:id', authenticate, asyncHandler(listingsController.withdraw));
