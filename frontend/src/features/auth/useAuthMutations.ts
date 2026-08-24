import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import type { AuthResponse, User } from '../../types/api';

// POST /auth/login (US-1.2) — stocke la session au succès.
export function useLogin() {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) => setSession(data),
  });
}

// POST /auth/register (US-1.1) puis login automatique pour enchaîner.
// `role` : le client choisit son profil à l'inscription (« buyer » = Acheteur &
// Vendeur, ou « organizer »). Défaut buyer.
export function useRegister() {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: async (input: { email: string; password: string; role?: 'buyer' | 'organizer' }) => {
      await api<User>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
      const { email, password } = input;
      return api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    onSuccess: (data) => setSession(data),
  });
}

// POST /auth/logout — révoque le refresh token puis vide la session locale.
export function useLogout() {
  const { refreshToken, clear } = useAuth.getState();
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(
          () => undefined,
        );
      }
    },
    onSuccess: () => clear(),
  });
}
