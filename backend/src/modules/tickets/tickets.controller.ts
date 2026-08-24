import type { Request, Response } from 'express';
import { ticketsService } from './tickets.service.js';
import { attachTicketSchema, giftTicketSchema, listMyTicketsQuery, validateQrSchema } from './tickets.schema.js';

export const ticketsController = {
  async mine(req: Request, res: Response) {
    const q = listMyTicketsQuery.parse(req.query);
    res.status(200).json(await ticketsService.listMine(req.user!.id, q));
  },

  async attach(req: Request, res: Response) {
    const input = attachTicketSchema.parse(req.body);
    res.status(201).json(await ticketsService.attach(req.user!.id, input));
  },

  async getById(req: Request, res: Response) {
    res.status(200).json(await ticketsService.getOwned(req.user!.id, req.params.id!));
  },

  async transfer(req: Request, res: Response) {
    const input = giftTicketSchema.parse(req.body);
    res.status(200).json(await ticketsService.giftTransfer(req.user!.id, req.params.id!, input));
  },

  async validate(req: Request, res: Response) {
    const { qrCode } = validateQrSchema.parse(req.body);
    res.status(200).json(await ticketsService.validate(qrCode, req.user!.id));
  },
};
