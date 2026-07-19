import type { Request, Response } from 'express';
import { ordersService } from './orders.service.js';
import { createOrderSchema, idempotencyKeySchema } from './orders.schema.js';
import { Errors } from '../../lib/errors.js';

export const ordersController = {
  async create(req: Request, res: Response) {
    const { listingId } = createOrderSchema.parse(req.body);
    const rawKey = req.header('Idempotency-Key');
    if (!rawKey) throw Errors.unprocessable('IDEMPOTENCY_KEY_REQUIRED', 'Header Idempotency-Key requis');
    const idempotencyKey = idempotencyKeySchema.parse(rawKey);

    const result = await ordersService.create(req.user!.id, listingId, idempotencyKey);
    res.status(201).json(result);
  },

  async getById(req: Request, res: Response) {
    res.status(200).json(await ordersService.getForBuyer(req.user!.id, req.params.id!));
  },

  async finalize(req: Request, res: Response) {
    res.status(200).json(await ordersService.finalize(req.user!.id, req.params.id!));
  },

  // Mode démo : simule un paiement réussi (bloqué si Stripe est configuré).
  async simulatePay(req: Request, res: Response) {
    res.status(200).json(await ordersService.simulatePayment(req.user!.id, req.params.id!));
  },

  async mine(req: Request, res: Response) {
    res.status(200).json(await ordersService.listMine(req.user!.id));
  },
};
