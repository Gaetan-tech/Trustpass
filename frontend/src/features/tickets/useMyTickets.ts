import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Paginated, Ticket } from '../../types/api';

// GET /tickets/me — billets possédés, filtre optionnel par statut (US-2.1).
export function useMyTickets(status?: Ticket['status']) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['tickets', 'me', status ?? 'all'],
    queryFn: () => api<Paginated<Ticket>>(`/tickets/me${qs}`),
  });
}
