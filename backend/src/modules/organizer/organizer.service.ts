import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';
import { getTicketHistory } from '../tickets/ticketHistory.js';

export const organizerService = {
  // Événements appartenant à l'organisateur (pour alimenter le dashboard).
  async listEvents(organizerId: string) {
    const rows = await prisma.event.findMany({
      where: { organizerId },
      orderBy: { startsAt: 'asc' },
      select: { id: true, name: true, venue: true, startsAt: true },
    });
    return { data: rows };
  },

  // US-8.1 — statistiques de revente d'un événement.
  async stats(organizerId: string, eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw Errors.notFound('Événement introuvable');
    if (event.organizerId !== organizerId) throw Errors.forbidden();

    const listingScope = { ticket: { eventId } };

    const [totalListings, soldListings, transferred, recent] = await Promise.all([
      prisma.listing.count({ where: listingScope }),
      prisma.listing.count({ where: { ...listingScope, status: 'sold' } }),
      prisma.order.aggregate({
        where: { status: 'transferred', listing: listingScope },
        _count: true,
        _avg: { amount: true },
      }),
      prisma.transfer.findMany({
        where: { ticket: { eventId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, createdAt: true, ticketId: true, toUserId: true },
      }),
    ]);

    return {
      resaleCount: transferred._count,
      avgPrice: transferred._avg.amount ? Math.round(transferred._avg.amount) : 0,
      resaleRate: totalListings > 0 ? Number((soldListings / totalListings).toFixed(2)) : 0,
      totalListings,
      soldListings,
      recentActivity: recent,
    };
  },

  // US-8.2 — billets d'un événement (pour consulter leur historique de possession).
  async listEventTickets(organizerId: string, eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw Errors.notFound('Événement introuvable');
    if (event.organizerId !== organizerId) throw Errors.forbidden();

    const tickets = await prisma.ticket.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { email: true } },
        ticketType: { select: { name: true } },
        _count: { select: { transfers: true } },
      },
    });

    return {
      data: tickets.map((t) => ({
        id: t.id,
        status: t.status,
        qrVersion: t.qrVersion,
        reference: t.reference ?? undefined,
        holderName: t.holderName ?? undefined,
        ticketType: t.ticketType?.name,
        ownerEmail: t.owner.email,
        transfersCount: t._count.transfers,
      })),
    };
  },

  // US-8.2 — historique complet d'un billet (tous les possesseurs, statut).
  async ticketHistory(organizerId: string, ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { event: { select: { organizerId: true } } },
    });
    if (!ticket) throw Errors.notFound('Billet introuvable');
    if (ticket.event.organizerId !== organizerId) throw Errors.forbidden();

    return getTicketHistory(ticketId);
  },
};
