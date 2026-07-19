import { z } from 'zod';

// Image : URL http(s) ou data URL d'image (upload compressé côté client), plafonnée.
const imageUrlSchema = z
  .string()
  .max(4_000_000)
  .refine((v) => v === '' || /^https?:\/\//.test(v) || v.startsWith('data:image/'), {
    message: 'URL ou data URL d’image invalide',
  });

export const createEventSchema = z.object({
  name: z.string().min(1),
  venue: z.string().optional(),
  startsAt: z.coerce.date(),
  imageUrl: imageUrlSchema.optional(),
  ticketTypes: z
    .array(z.object({ name: z.string().min(1), faceValue: z.number().int().positive() }))
    .optional(),
});

// Édition d'un événement (US-6.3) — tous les champs optionnels, au moins un requis.
export const updateEventSchema = z
  .object({
    name: z.string().min(1).optional(),
    venue: z.string().optional(), // "" => efface le lieu
    startsAt: z.coerce.date().optional(),
    imageUrl: imageUrlSchema.optional(), // "" => efface l'image
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' });

export const upsertRuleSchema = z.object({
  ticketTypeId: z.string().uuid().nullish(),
  priceCap: z.number().int().positive(),
  resaleOpensAt: z.coerce.date().optional(),
  resaleClosesAt: z.coerce.date().optional(),
  commissionBps: z.number().int().min(0).max(10000).optional(),
});

export const listEventsQuery = z.object({
  q: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
