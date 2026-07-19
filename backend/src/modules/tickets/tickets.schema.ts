import { z } from 'zod';

// US-2.1 — rattachement d'un billet possédé. eventId = événement interne,
// ticketRef = référence unique de la billetterie source (rend l'attach idempotent).
export const attachTicketSchema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid().optional(),
  ticketRef: z.string().min(1),
});

export const validateQrSchema = z.object({
  qrCode: z.string().min(1),
});

// Transfert nominatif direct (don) d'un billet possédé vers une autre personne.
// Si l'email correspond à un compte, la propriété est réassignée ; sinon le billet
// devient nominatif au nom saisi. Dans tous les cas le QR est régénéré (ancien invalidé).
export const giftTicketSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const listMyTicketsQuery = z.object({
  status: z
    .enum(['owned', 'listed', 'reserved', 'sold', 'used', 'invalidated'])
    .optional(),
});
