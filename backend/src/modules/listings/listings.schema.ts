import { z } from 'zod';

export const createListingSchema = z.object({
  ticketId: z.string().uuid(),
  price: z.number().int().positive(), // centimes
});

export const listListingsQuery = z.object({
  eventId: z.string().uuid().optional(),
  ticketTypeId: z.string().uuid().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  sort: z.enum(['price', 'createdAt']).default('createdAt'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
