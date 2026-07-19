import type { Event } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { Errors } from '../../lib/errors.js';

export interface ResolvedRule {
  priceCap: number;
  commissionBps: number;
  resaleOpensAt: Date | null;
  resaleClosesAt: Date; // défaut : startsAt - 1h
}

const ONE_HOUR_MS = 60 * 60 * 1000;

// Résout la règle applicable : override par ticketType, sinon règle événement (ADR-002).
export async function resolveRule(
  event: Event,
  ticketTypeId: string | null,
): Promise<ResolvedRule> {
  // findFirst (pas findUnique) : une contrainte unique composite avec colonne
  // nullable ne se requête pas proprement par clé unique côté Prisma.
  const rule =
    (ticketTypeId
      ? await prisma.organizerRule.findFirst({ where: { eventId: event.id, ticketTypeId } })
      : null) ?? (await prisma.organizerRule.findFirst({ where: { eventId: event.id, ticketTypeId: null } }));

  if (!rule) throw Errors.unprocessable('NO_RESALE_RULE', 'Aucune règle de revente définie');

  return {
    priceCap: rule.priceCap,
    commissionBps: rule.commissionBps,
    resaleOpensAt: rule.resaleOpensAt,
    resaleClosesAt: rule.resaleClosesAt ?? new Date(event.startsAt.getTime() - ONE_HOUR_MS),
  };
}

// Vérifie que la fenêtre de revente est ouverte (US-3.1 / US-6.2).
export function assertWindowOpen(rule: ResolvedRule, now = new Date()): void {
  if (rule.resaleOpensAt && now < rule.resaleOpensAt) {
    throw Errors.unprocessable('RESALE_WINDOW_CLOSED', 'La revente n’est pas encore ouverte');
  }
  if (now >= rule.resaleClosesAt) {
    throw Errors.unprocessable('RESALE_WINDOW_CLOSED', 'La revente est clôturée');
  }
}

// Vérifie que le prix respecte le plafond (US-3.1 / US-6.1).
export function assertPriceWithinCap(price: number, rule: ResolvedRule): void {
  if (price > rule.priceCap) {
    throw Errors.unprocessable('PRICE_ABOVE_CAP', 'Prix au-dessus du plafond autorisé', {
      priceCap: rule.priceCap,
    });
  }
}
