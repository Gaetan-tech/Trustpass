import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { OrderStatusResponse } from '../../types/api';

// GET /orders/:id — suit l'état de la commande. Poll tant que le paiement/transfert
// n'est pas finalisé (le transfert est déclenché par le webhook Stripe, US-4.3/5.1).
export function useOrderStatus(orderId: string | null) {
  return useQuery({
    queryKey: ['order', orderId],
    enabled: Boolean(orderId),
    queryFn: () => api<OrderStatusResponse>(`/orders/${orderId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'transferred' || status === 'failed' ? false : 2000;
    },
  });
}
