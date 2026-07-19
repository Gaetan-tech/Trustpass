import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';
import { generateQr, generateReference } from '../../lib/qr.js';
import { writeAudit } from '../../lib/audit.js';
import { enqueueEmail } from '../notifications/notifications.service.js';
import { getTicketHistory } from './ticketHistory.js';
import type { attachTicketSchema, giftTicketSchema, listMyTicketsQuery } from './tickets.schema.js';

const ticketInclude = { event: true, ticketType: true } satisfies Prisma.TicketInclude;

export const ticketsService = {
  // US-2.1 — rattache un billet possédé. Idempotence via externalRef (ticketRef).
  async attach(ownerId: string, input: z.infer<typeof attachTicketSchema>) {
    const event = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw Errors.notFound('Événement introuvable');

    const existing = await prisma.ticket.findUnique({ where: { externalRef: input.ticketRef } });
    if (existing) {
      // Déjà rattaché : conflit sauf si c'est le même propriétaire et encore "owned".
      if (existing.ownerId === ownerId && existing.status === 'owned') {
        return { id: existing.id, status: existing.status };
      }
      throw Errors.conflict('TICKET_ALREADY_ATTACHED', 'Billet déjà rattaché');
    }

    const ticket = await prisma.ticket.create({
      data: {
        eventId: event.id,
        ticketTypeId: input.ticketTypeId ?? null,
        ownerId,
        status: 'owned',
        externalRef: input.ticketRef,
        qrCode: generateQr('new', 1),
        qrVersion: 1,
        reference: generateReference(),
      },
    });
    await writeAudit({ actorId: ownerId, action: 'ticket_attach', targetType: 'ticket', targetId: ticket.id });
    return { id: ticket.id, status: ticket.status };
  },

  async listMine(ownerId: string, q: z.infer<typeof listMyTicketsQuery>) {
    const rows = await prisma.ticket.findMany({
      where: { ownerId, ...(q.status ? { status: q.status } : {}) },
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map(toDto) };
  },

  async getOwned(ownerId: string, id: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) throw Errors.notFound('Billet introuvable');
    if (ticket.ownerId !== ownerId) throw Errors.forbidden();
    return { ...toDto(ticket), qrCode: ticket.qrCode };
  },

  // Transfert nominatif direct (don) — hors marketplace (US-5.2).
  // Atomique : rotation du QR (invalide l'ancien) + mise à jour du porteur, et
  // réassignation de la propriété si le destinataire a un compte TrustPass.
  async giftTransfer(ownerId: string, ticketId: string, input: z.infer<typeof giftTicketSchema>) {
    const email = input.email.toLowerCase();
    const recipient = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw Errors.notFound('Billet introuvable');
      if (ticket.ownerId !== ownerId) throw Errors.forbidden();
      // Transférable tant que le billet n'est pas passé au contrôle d'accès (US-5.3).
      if (ticket.status === 'used' || ticket.status === 'invalidated') {
        throw Errors.conflict('TICKET_ALREADY_USED', 'Ce billet est déjà passé au contrôle d’accès et ne peut plus être transféré');
      }
      if (ticket.status !== 'owned') {
        throw Errors.conflict('TICKET_NOT_TRANSFERABLE', 'Retire d’abord ce billet de la vente pour le transférer');
      }

      const oldQr = ticket.qrCode;
      const newQr = generateQr(ticket.id, ticket.qrVersion + 1);

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        include: ticketInclude,
        data: {
          ownerId: recipient?.id ?? ticket.ownerId,
          holderName: input.name,
          holderEmail: email,
          qrCode: newQr,
          qrVersion: { increment: 1 },
          reference: generateReference(), // nouvelle référence à chaque transfert
        },
      });

      // Trace de transfert (alimente l'historique des possesseurs, comme la revente).
      await tx.transfer.create({
        data: {
          kind: 'gift',
          ticketId: ticket.id,
          fromUserId: ownerId,
          toUserId: recipient?.id ?? null,
          toHolderName: input.name,
          toEmail: email,
          oldQrCode: oldQr,
          newQrCode: newQr,
        },
      });

      await writeAudit(
        {
          actorId: ownerId,
          action: 'ownership_transfer',
          targetType: 'ticket',
          targetId: ticket.id,
          metadata: { gift: true, toEmail: email, toUserId: recipient?.id ?? null },
        },
        tx,
      );
      await writeAudit(
        { actorId: ownerId, action: 'qr_invalidate', targetType: 'ticket', targetId: ticket.id, metadata: { oldQr } },
        tx,
      );

      return {
        dto: { ...toDto(updated), qrCode: updated.qrCode, reassigned: Boolean(recipient) },
        eventName: updated.event.name,
        reference: updated.reference ?? '',
      };
    });

    // Email au destinataire (best-effort, hors transaction). En dev : loggé.
    await enqueueEmail({
      type: 'ticket_received',
      to: email,
      eventName: result.eventName,
      holderName: input.name,
      reference: result.reference,
      hasAccount: result.dto.reassigned,
    });

    return result.dto;
  },

  // US-7.1 — validation à l'entrée. Renvoie toujours 200 avec un verdict, et — dès que
  // le billet est connu — le porteur courant + l'historique des possesseurs (US-7.2).
  async validate(qrCode: string) {
    const ticket = await prisma.ticket.findUnique({ where: { qrCode }, include: { event: true } });
    if (!ticket) return { valid: false as const, reason: 'UNKNOWN' as const };

    let verdict:
      | { valid: true; ticketId: string; event: { id: string; name: string } }
      | { valid: false; reason: 'ALREADY_USED' | 'INVALIDATED' };

    if (ticket.status === 'invalidated') {
      verdict = { valid: false, reason: 'INVALIDATED' };
    } else if (ticket.status === 'used') {
      verdict = { valid: false, reason: 'ALREADY_USED' };
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'used' } });
        await writeAudit({ action: 'entry_scan', targetType: 'ticket', targetId: ticket.id }, tx);
      });
      verdict = { valid: true, ticketId: ticket.id, event: { id: ticket.event.id, name: ticket.event.name } };
    }

    // Porteur + historique (nom du propriétaire visible par le contrôleur).
    const info = await getTicketHistory(ticket.id);
    const owner = info
      ? { email: info.ticket.currentOwner.email, name: info.ticket.holderName ?? null }
      : undefined;

    return { ...verdict, owner, history: info?.history ?? [] };
  },
};

type TicketWithRel = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

function toDto(t: TicketWithRel) {
  return {
    id: t.id,
    status: t.status,
    qrVersion: t.qrVersion,
    reference: t.reference ?? undefined,
    holderName: t.holderName ?? undefined,
    holderEmail: t.holderEmail ?? undefined,
    event: {
      id: t.event.id,
      name: t.event.name,
      venue: t.event.venue ?? undefined,
      startsAt: t.event.startsAt,
    },
    ticketType: t.ticketType ? { id: t.ticketType.id, name: t.ticketType.name } : undefined,
  };
}
