import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';
import type { createEventSchema, listEventsQuery, updateEventSchema, upsertRuleSchema } from './events.schema.js';

export const eventsService = {
  // US-3.2 — liste publique paginée.
  async list(q: z.infer<typeof listEventsQuery>) {
    const where: Prisma.EventWhereInput = {
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(q.from || q.to ? { startsAt: { gte: q.from, lte: q.to } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: { id: true, name: true, venue: true, startsAt: true, imageUrl: true },
      }),
      prisma.event.count({ where }),
    ]);
    return { data: rows, page: q.page, limit: q.limit, total };
  },

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: { select: { id: true, name: true, faceValue: true } } },
    });
    if (!event) throw Errors.notFound('Événement introuvable');
    return event;
  },

  // US-3.1 — règles applicables (plafond, fenêtre) pour l'affichage front.
  async getRules(eventId: string) {
    const rules = await prisma.organizerRule.findMany({ where: { eventId } });
    const global = rules.find((r) => r.ticketTypeId === null) ?? null;
    return {
      priceCap: global?.priceCap ?? null,
      resaleOpensAt: global?.resaleOpensAt ?? null,
      resaleClosesAt: global?.resaleClosesAt ?? null,
      byTicketType: rules
        .filter((r) => r.ticketTypeId !== null)
        .map((r) => ({ ticketTypeId: r.ticketTypeId, priceCap: r.priceCap })),
    };
  },

  // US-6.x — création d'événement par l'organisateur.
  async create(organizerId: string, input: z.infer<typeof createEventSchema>) {
    return prisma.event.create({
      data: {
        organizerId,
        name: input.name,
        venue: input.venue,
        startsAt: input.startsAt,
        imageUrl: input.imageUrl || null,
        ticketTypes: input.ticketTypes
          ? { create: input.ticketTypes.map((t) => ({ name: t.name, faceValue: t.faceValue })) }
          : undefined,
      },
      include: { ticketTypes: true },
    });
  },

  // US-6.3 — édition d'un événement (nom, lieu, date) par l'organisateur propriétaire.
  async update(
    organizerId: string,
    eventId: string,
    input: z.infer<typeof updateEventSchema>,
  ) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw Errors.notFound('Événement introuvable');
    if (event.organizerId !== organizerId) throw Errors.forbidden();

    return prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.venue !== undefined ? { venue: input.venue || null } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      },
      include: { ticketTypes: { select: { id: true, name: true, faceValue: true } } },
    });
  },

  // US-6.3 — suppression d'un événement (organisateur propriétaire).
  // Refusée s'il existe déjà des billets rattachés (intégrité). Les règles et
  // catégories sont supprimées en cascade (cf. schema.prisma).
  async remove(organizerId: string, eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { tickets: true } } },
    });
    if (!event) throw Errors.notFound('Événement introuvable');
    if (event.organizerId !== organizerId) throw Errors.forbidden();
    if (event._count.tickets > 0) {
      throw Errors.conflict('EVENT_HAS_TICKETS', 'Impossible de supprimer un événement avec des billets rattachés');
    }
    await prisma.event.delete({ where: { id: eventId } });
  },

  // US-6.1/6.2 — upsert d'une règle de revente (portée événement ou ticketType).
  async upsertRule(
    organizerId: string,
    eventId: string,
    input: z.infer<typeof upsertRuleSchema>,
  ) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw Errors.notFound('Événement introuvable');
    if (event.organizerId !== organizerId) throw Errors.forbidden();

    if (input.resaleOpensAt && input.resaleClosesAt && input.resaleClosesAt <= input.resaleOpensAt) {
      throw Errors.unprocessable('INVALID_WINDOW', 'La clôture doit être postérieure à l’ouverture');
    }

    const ticketTypeId = input.ticketTypeId ?? null;
    const existing = await prisma.organizerRule.findFirst({ where: { eventId, ticketTypeId } });

    const data = {
      priceCap: input.priceCap,
      resaleOpensAt: input.resaleOpensAt ?? null,
      resaleClosesAt: input.resaleClosesAt ?? null,
      ...(input.commissionBps != null ? { commissionBps: input.commissionBps } : {}),
    };

    return existing
      ? prisma.organizerRule.update({ where: { id: existing.id }, data })
      : prisma.organizerRule.create({ data: { eventId, ticketTypeId, ...data } });
  },
};
