import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface CreateListingInput {
  ticketId: string;
  price: number; // centimes
}

// POST /listings — publie une annonce de revente (US-3.1).
export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingInput) =>
      api<{ id: string; status: string }>('/listings', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', 'me'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}
