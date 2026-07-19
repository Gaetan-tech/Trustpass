import type { Request, Response } from 'express';
import { eventsService } from './events.service.js';
import { createEventSchema, listEventsQuery, updateEventSchema, upsertRuleSchema } from './events.schema.js';

export const eventsController = {
  async list(req: Request, res: Response) {
    res.status(200).json(await eventsService.list(listEventsQuery.parse(req.query)));
  },

  async getById(req: Request, res: Response) {
    res.status(200).json(await eventsService.getById(req.params.id!));
  },

  async getRules(req: Request, res: Response) {
    res.status(200).json(await eventsService.getRules(req.params.id!));
  },

  async create(req: Request, res: Response) {
    const input = createEventSchema.parse(req.body);
    res.status(201).json(await eventsService.create(req.user!.id, input));
  },

  async upsertRule(req: Request, res: Response) {
    const input = upsertRuleSchema.parse(req.body);
    res.status(200).json(await eventsService.upsertRule(req.user!.id, req.params.id!, input));
  },

  async update(req: Request, res: Response) {
    const input = updateEventSchema.parse(req.body);
    res.status(200).json(await eventsService.update(req.user!.id, req.params.id!, input));
  },

  async remove(req: Request, res: Response) {
    await eventsService.remove(req.user!.id, req.params.id!);
    res.status(204).send();
  },
};
