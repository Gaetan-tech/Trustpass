import { z } from 'zod';

export const createOrderSchema = z.object({
  listingId: z.string().uuid(),
});

// Le header Idempotency-Key est obligatoire (US-4.2 / ADR-003).
export const idempotencyKeySchema = z.string().uuid('Idempotency-Key doit être un UUID');
