import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Listing, Paginated } from '../../types/api';

// GET /listings — annonces actives (US-3.2).
export function useListings(eventId?: string) {
  const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
  return useQuery({
    queryKey: ['listings', eventId ?? 'all'],
    queryFn: () => api<Paginated<Listing>>(`/listings${qs}`),
  });
}
