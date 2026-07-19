import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { EventDetail, EventRules, EventSummary, Paginated } from '../../types/api';

// GET /events — catalogue public (pour le carrousel / featured).
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => api<Paginated<EventSummary>>('/events'),
  });
}

// GET /events/:id — détail d'un événement.
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    enabled: Boolean(id),
    queryFn: () => api<EventDetail>(`/events/${id}`),
  });
}

// GET /events/:id/rules — règles de revente (plafond, fenêtre).
export function useEventRules(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id, 'rules'],
    enabled: Boolean(id),
    queryFn: () => api<EventRules>(`/events/${id}/rules`),
  });
}
