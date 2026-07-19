import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { TransferTicketResponse } from '../../types/api';

interface TransferInput {
  ticketId: string;
  name: string;
  email: string;
}

// POST /tickets/:id/transfer — don nominatif d'un billet à une autre personne (US-5.2).
// Régénère le QR (ancien invalidé) et réassigne la propriété si le destinataire a un compte.
export function useTransferTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, name, email }: TransferInput) =>
      api<TransferTicketResponse>(`/tickets/${ticketId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', 'me'] }),
  });
}
