import type { Request, Response } from 'express';
import { listingsService } from './listings.service.js';
import { createListingSchema, listListingsQuery } from './listings.schema.js';

export const listingsController = {
  async list(req: Request, res: Response) {
    const q = listListingsQuery.parse(req.query);
    res.status(200).json(await listingsService.list(q));
  },

  async mine(req: Request, res: Response) {
    res.status(200).json(await listingsService.listMine(req.user!.id));
  },

  async getById(req: Request, res: Response) {
    res.status(200).json(await listingsService.getById(req.params.id!));
  },

  async create(req: Request, res: Response) {
    const input = createListingSchema.parse(req.body);
    const listing = await listingsService.publish(req.user!.id, input);
    res.status(201).json({ id: listing.id, status: listing.status });
  },

  async withdraw(req: Request, res: Response) {
    await listingsService.withdraw(req.user!.id, req.params.id!);
    res.status(204).send();
  },
};
