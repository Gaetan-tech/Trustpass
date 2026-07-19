import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ValidateResponse } from '../../types/api';

// POST /tickets/validate — contrôle d'accès (US-7.1). Verdict renvoyé en 200.
export function useValidateTicket() {
  return useMutation({
    mutationFn: (qrCode: string) =>
      api<ValidateResponse>('/tickets/validate', {
        method: 'POST',
        body: JSON.stringify({ qrCode }),
      }),
  });
}
