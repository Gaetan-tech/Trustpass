import { prisma } from '../../lib/prisma.js';

export interface HistoryEntry {
  type: 'attach' | 'purchase' | 'gift';
  at: Date;
  from?: string; // possesseur précédent (email)
  to?: string;   // nouveau possesseur (email de compte, ou « Nom (email) » si nominatif)
}

export interface TicketHistoryResult {
  ticket: {
    id: string;
    status: string;
    qrVersion: number;
    reference?: string;
    holderName?: string;
    holderEmail?: string;
    currentOwner: { id: string; email: string };
    event: { id: string; name: string; venue?: string; startsAt: Date };
    ticketType?: { id: string; name: string };
  };
  history: HistoryEntry[];
}

// Reconstruit l'historique complet des possesseurs d'un billet :
// possesseur d'origine (rattachement) puis chaque transfert (revente ou don), dans l'ordre.
export async function getTicketHistory(ticketId: string): Promise<TicketHistoryResult | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      event: true,
      ticketType: { select: { id: true, name: true } },
      owner: { select: { id: true, email: true } },
    },
  });
  if (!ticket) return null;

  const transfers = await prisma.transfer.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, fromUserId: true, toUserId: true, toHolderName: true, toEmail: true, createdAt: true },
  });

  // Résolution des emails des comptes impliqués (batch).
  const ids = new Set<string>();
  for (const t of transfers) {
    ids.add(t.fromUserId);
    if (t.toUserId) ids.add(t.toUserId);
  }
  const users = ids.size
    ? await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true } })
    : [];
  const emailOf = new Map(users.map((u) => [u.id, u.email]));

  const displayTo = (t: (typeof transfers)[number]): string | undefined => {
    if (t.toUserId) return emailOf.get(t.toUserId);
    if (t.toHolderName && t.toEmail) return `${t.toHolderName} (${t.toEmail})`;
    return t.toHolderName ?? t.toEmail ?? undefined;
  };

  // Possesseur d'origine : émetteur du 1er transfert, sinon propriétaire actuel (jamais transféré).
  const originEmail = transfers.length ? emailOf.get(transfers[0]!.fromUserId) : ticket.owner.email;

  const history: HistoryEntry[] = [{ type: 'attach', at: ticket.createdAt, to: originEmail }];
  for (const t of transfers) {
    history.push({ type: t.kind, at: t.createdAt, from: emailOf.get(t.fromUserId), to: displayTo(t) });
  }

  return {
    ticket: {
      id: ticket.id,
      status: ticket.status,
      qrVersion: ticket.qrVersion,
      reference: ticket.reference ?? undefined,
      holderName: ticket.holderName ?? undefined,
      holderEmail: ticket.holderEmail ?? undefined,
      currentOwner: { id: ticket.owner.id, email: ticket.owner.email },
      event: {
        id: ticket.event.id,
        name: ticket.event.name,
        venue: ticket.event.venue ?? undefined,
        startsAt: ticket.event.startsAt,
      },
      ticketType: ticket.ticketType ?? undefined,
    },
    history,
  };
}
