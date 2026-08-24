import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { OrderStatusResponse } from '../../types/api';

// POST /orders/:id/finalize — confirme le paiement au retour de Stripe Checkout
// (vérifie l'état de la session côté serveur puis déclenche le transfert).
export function useFinalizeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<OrderStatusResponse>(`/orders/${orderId}/finalize`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', 'me'] });
      qc.invalidateQueries({ queryKey: ['listings'] }); // l'annonce vendue quitte la marketplace
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
