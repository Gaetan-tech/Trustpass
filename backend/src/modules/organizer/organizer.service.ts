import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';
import { getTicketHistory } from '../tickets/ticketHistory.js';
import type { CreateControllerInput } from './organizer.schema.js';

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
