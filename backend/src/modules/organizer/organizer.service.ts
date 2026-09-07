import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';
import { getTicketHistory } from '../tickets/ticketHistory.js';
import type { TicketStatus } from '@prisma/client';
import type { CreateControllerInput } from './organizer.schema.js';

// Statuts de billet possibles (aligné sur l'enum Prisma TicketStatus).
const TICKET_STATUSES: TicketStatus[] = ['owned', 'listed', 'reserved', 'sold', 'used', 'invalidated'];

type StatusBreakdown = Record<TicketStatus, number>;

interface DashboardRow {
  eventId: string;
  name: string;
  venue?: string;
  startsAt: string;
  ticketsIssued: number;
  ticketsResold: number;      // reventes marketplace finalisées
  ticketsTransferred: number; // dons nominatifs (hors marketplace)
  revenue: number;            // centimes (paiements simulés confirmés)
  statusBreakdown: StatusBreakdown;
}

interface DashboardTotals {
  events: number;
  ticketsIssued: number;
  ticketsResold: number;
  ticketsTransferred: number;
  revenue: number;
}

function emptyBreakdown(): StatusBreakdown {
  return Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as StatusBreakdown;
}

function emptyTotals(): DashboardTotals {
  return { events: 0, ticketsIssued: 0, ticketsResold: 0, ticketsTransferred: 0, revenue: 0 };
}

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

  // Vue d'ensemble multi-événements (KAN-51) : pour chaque événement de
  // l'organisateur, billets émis, revendus (marketplace), transférés (don),
  // répartition par statut et recette (somme des paiements simulés confirmés).
  async dashboard(organizerId: string) {
    const events = await prisma.event.findMany({
      where: { organizerId },
      orderBy: { startsAt: 'asc' },
      select: { id: true, name: true, venue: true, startsAt: true },
    });
    const eventIds = events.map((e) => e.id);

    if (eventIds.length === 0) {
      return { data: [], totals: emptyTotals() };
    }

    const scope = { in: eventIds };
    const [ticketGroups, paidOrders, giftTransfers] = await Promise.all([
      // Billets émis + répartition par statut.
      prisma.ticket.groupBy({
        by: ['eventId', 'status'],
        where: { eventId: scope },
        _count: { _all: true },
      }),
      // Recette + billets revendus : commandes confirmées (paiement simulé).
      // Les commandes ne portent pas l'eventId → on remonte via listing.ticket.
      prisma.order.findMany({
        where: { status: { in: ['paid', 'transferred'] }, listing: { ticket: { eventId: scope } } },
        select: { amount: true, status: true, listing: { select: { ticket: { select: { eventId: true } } } } },
      }),
      // Billets transférés hors marketplace (dons nominatifs).
      prisma.transfer.findMany({
        where: { kind: 'gift', ticket: { eventId: scope } },
        select: { ticket: { select: { eventId: true } } },
      }),
    ]);

    // Indexe les agrégats par eventId pour une reconstruction en O(n).
    const rows = new Map<string, DashboardRow>();
    for (const ev of events) {
      rows.set(ev.id, {
        eventId: ev.id,
        name: ev.name,
        venue: ev.venue ?? undefined,
        startsAt: ev.startsAt.toISOString(),
        ticketsIssued: 0,
        ticketsResold: 0,
        ticketsTransferred: 0,
        revenue: 0,
        statusBreakdown: emptyBreakdown(),
      });
    }

    for (const g of ticketGroups) {
      const row = rows.get(g.eventId);
      if (!row) continue;
      const count = g._count._all;
      row.ticketsIssued += count;
      row.statusBreakdown[g.status] = count;
    }

    for (const o of paidOrders) {
      const row = rows.get(o.listing.ticket.eventId);
      if (!row) continue;
      row.revenue += o.amount;
      if (o.status === 'transferred') row.ticketsResold += 1;
    }

    for (const t of giftTransfers) {
      const row = rows.get(t.ticket.eventId);
      if (row) row.ticketsTransferred += 1;
    }

    const data = events.map((e) => rows.get(e.id)!);
    const totals = data.reduce<DashboardTotals>((acc, r) => {
      acc.ticketsIssued += r.ticketsIssued;
      acc.ticketsResold += r.ticketsResold;
      acc.ticketsTransferred += r.ticketsTransferred;
      acc.revenue += r.revenue;
      return acc;
    }, { ...emptyTotals(), events: data.length });

    return { data, totals };
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

  // --- Comptes contrôleur gérés par l'organisateur -------------------------
  // Un organisateur crée ses propres contrôleurs (email + mot de passe). Chaque
  // contrôleur est rattaché à l'organisateur via managedByOrganizerId, ce qui
  // restreint ses scans aux événements de cet organisateur (voir tickets.service).
  async createController(organizerId: string, input: CreateControllerInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw Errors.conflict('EMAIL_TAKEN', 'Email déjà utilisé');
    const passwordHash = await argon2.hash(input.password);
    const controller = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'controller',
        managedByOrganizerId: organizerId,
        emailVerifiedAt: new Date(), // compte de service : pas de vérification email
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return controller;
  },

  async listControllers(organizerId: string) {
    const data = await prisma.user.findMany({
      where: { role: 'controller', managedByOrganizerId: organizerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, createdAt: true },
    });
    return { data };
  },

  async revokeController(organizerId: string, controllerId: string) {
    const c = await prisma.user.findUnique({
      where: { id: controllerId },
      select: { id: true, role: true, managedByOrganizerId: true },
    });
    if (!c || c.role !== 'controller' || c.managedByOrganizerId !== organizerId) {
      throw Errors.notFound('Contrôleur introuvable');
    }
    // Les refresh tokens partent en cascade ; les logs d'audit sont conservés
    // (actorId passe à null via onDelete: SetNull).
    await prisma.user.delete({ where: { id: controllerId } });
    return { revoked: true };
  },
};
