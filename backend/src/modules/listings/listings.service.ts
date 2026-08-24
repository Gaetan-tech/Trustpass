import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import { resolveRule, assertWindowOpen, assertPriceWithinCap } from '../rules/rules.service.js';
import { z } from 'zod';
import type { createListingSchema, listListingsQuery } from './listings.schema.js';

const listingInclude = {
  ticket: { include: { event: true, ticketType: true } },
} satisfies Prisma.ListingInclude;

export const listingsService = {
  // US-3.1 — publication d'une annonce (plafond + fenêtre).
  async publish(sellerId: string, input: z.infer<typeof createListingSchema>) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
      include: { event: true },
    });
    if (!ticket) throw Errors.notFound('Billet introuvable');
    if (ticket.ownerId !== sellerId) throw Errors.forbidden('Vous ne possédez pas ce billet');
    if (ticket.status !== 'owned') {
      throw Errors.conflict('TICKET_NOT_LISTABLE', 'Billet non disponible à la revente');
    }

    const rule = await resolveRule(ticket.event, ticket.ticketTypeId);
    assertWindowOpen(rule);
    assertPriceWithinCap(input.price, rule);

    return prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: { ticketId: ticket.id, sellerId, price: input.price, status: 'active' },
      });
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'listed' } });
      await writeAudit(
        { actorId: sellerId, action: 'listing_publish', targetType: 'listing', targetId: listing.id, amount: input.price },
        tx,
      );
      return listing;
    });
  },

  // US-3.3 — retrait d'une annonce active.
  async withdraw(sellerId: string, listingId: string) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw Errors.notFound('Annonce introuvable');
    if (listing.sellerId !== sellerId) throw Errors.forbidden();
    if (listing.status !== 'active') {
      throw Errors.conflict('LISTING_NOT_WITHDRAWABLE', 'Annonce non retirable dans cet état');
    }
    await prisma.$transaction(async (tx) => {
      await tx.listing.update({ where: { id: listingId }, data: { status: 'withdrawn' } });
      await tx.ticket.update({ where: { id: listing.ticketId }, data: { status: 'owned' } });
      await writeAudit(
        { actorId: sellerId, action: 'listing_withdraw', targetType: 'listing', targetId: listingId },
        tx,
      );
    });
  },

  // US-3.2 — liste publique des annonces actives.
  async list(q: z.infer<typeof listListingsQuery>) {
    // On n'affiche que les annonces dont la revente est encore ouverte : la
    // clôture par défaut = début de l'événement − 1 h. Ainsi une annonce
    // invendable (événement passé/imminent) ne s'affiche pas dans la marketplace.
    // La règle exacte (fenêtres personnalisées) reste garantie à l'achat.
    const resaleOpenThreshold = new Date(Date.now() + 60 * 60 * 1000);
    const where: Prisma.ListingWhereInput = {
      status: 'active',
      ...(q.maxPrice ? { price: { lte: q.maxPrice } } : {}),
      ticket: {
        ...(q.eventId ? { eventId: q.eventId } : {}),
        ...(q.ticketTypeId ? { ticketTypeId: q.ticketTypeId } : {}),
        event: { startsAt: { gt: resaleOpenThreshold } },
      },
    };
    const [rows, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: listingInclude,
        orderBy: q.sort === 'price' ? { price: 'asc' } : { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.listing.count({ where }),
    ]);
    return { data: rows.map(toDto), page: q.page, limit: q.limit, total };
  },

  async getById(id: string) {
    const listing = await prisma.listing.findFirst({
      where: { id, status: 'active' },
      include: listingInclude,
    });
    if (!listing) throw Errors.notFound('Annonce introuvable');
    return toDto(listing);
  },

  async listMine(sellerId: string) {
    const rows = await prisma.listing.findMany({
      where: { sellerId },
      include: listingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map(toDto) };
  },
};

type ListingWithTicket = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

function toDto(l: ListingWithTicket) {
  return {
    id: l.id,
    price: l.price,
    event: {
      id: l.ticket.event.id,
      name: l.ticket.event.name,
      venue: l.ticket.event.venue ?? undefined,
      startsAt: l.ticket.event.startsAt,
      imageUrl: l.ticket.event.imageUrl ?? undefined,
    },
    ticketType: l.ticket.ticketType
      ? { id: l.ticket.ticketType.id, name: l.ticket.ticketType.name }
      : undefined,
  };
}
