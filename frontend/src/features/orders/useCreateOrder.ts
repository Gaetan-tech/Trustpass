import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CreateOrderResponse } from '../../types/api';

// POST /orders — réserve l'annonce et crée l'intent de paiement (US-4.1/4.2).
// Une clé d'idempotence est générée par tentative pour éviter le double débit.
export function useCreateOrder() {
  return useMutation({
    mutationFn: (listingId: string) =>
      api<CreateOrderResponse>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ listingId }),
      }),
  });
}
