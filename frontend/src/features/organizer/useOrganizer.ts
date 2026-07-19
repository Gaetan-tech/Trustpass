import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  CreateEventInput,
  EventRules,
  EventStats,
  EventSummary,
  OrganizerTicketSummary,
  TicketHistory,
  UpdateEventInput,
} from '../../types/api';

// GET /organizer/events — événements de l'organisateur connecté.
export function useMyEvents(enabled: boolean) {
  return useQuery({
    queryKey: ['organizer', 'events'],
    enabled,
    queryFn: () => api<{ data: EventSummary[] }>('/organizer/events'),
  });
}

// GET /organizer/events/:id/stats — statistiques de revente (US-8.1).
export function useEventStats(eventId: string | null) {
  return useQuery({
    queryKey: ['organizer', 'stats', eventId],
    enabled: Boolean(eventId),
    queryFn: () => api<EventStats>(`/organizer/events/${eventId}/stats`),
  });
}

// GET /events/:id/rules — règle applicable (plafond, fenêtre) de l'événement sélectionné.
export function useEventRulesFor(eventId: string | null) {
  return useQuery({
    queryKey: ['event', eventId, 'rules'],
    enabled: Boolean(eventId),
    queryFn: () => api<EventRules>(`/events/${eventId}/rules`),
  });
}

// PUT /events/:id/rules — fixe le plafond de revente d'un événement (US-6.1).
export function useSetPriceCap(eventId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (priceCap: number) =>
      api<unknown>(`/events/${eventId}/rules`, {
        method: 'PUT',
        body: JSON.stringify({ priceCap }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId, 'rules'] });
      qc.invalidateQueries({ queryKey: ['organizer', 'stats', eventId] });
    },
  });
}

// POST /events — création d'un événement (US-6.3).
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      api<{ id: string }>('/events', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizer', 'events'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// PUT /events/:id — édition d'un événement (nom, lieu, date) (US-6.3).
export function useUpdateEvent(eventId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) =>
      api<{ id: string }>(`/events/${eventId}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizer', 'events'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}

// DELETE /events/:id — suppression d'un événement sans billet (US-6.3).
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api<void>(`/events/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizer', 'events'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// GET /organizer/events/:id/tickets — billets d'un événement (US-8.2).
export function useEventTickets(eventId: string | null) {
  return useQuery({
    queryKey: ['organizer', 'tickets', eventId],
    enabled: Boolean(eventId),
    queryFn: () => api<{ data: OrganizerTicketSummary[] }>(`/organizer/events/${eventId}/tickets`),
  });
}

// GET /organizer/tickets/:id/history — historique de possession d'un billet (US-8.2).
export function useTicketHistory(ticketId: string | null) {
  return useQuery({
    queryKey: ['organizer', 'ticket-history', ticketId],
    enabled: Boolean(ticketId),
    queryFn: () => api<TicketHistory>(`/organizer/tickets/${ticketId}/history`),
  });
}
