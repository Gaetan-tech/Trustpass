import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface AttachInput {
  eventId: string;
  ticketTypeId?: string;
  ticketRef: string;
}

// POST /tickets/attach — rattache un billet possédé (US-2.1).
export function useAttachTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachInput) =>
      api<{ id: string; status: string }>('/tickets/attach', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', 'me'] }),
  });
}
