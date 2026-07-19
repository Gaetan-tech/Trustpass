import { useAuth } from '../store/auth';
import type { ApiError } from '../types/api';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

// Un seul refresh à la fois : les appels 401 concurrents attendent le même résultat.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken, setSession, user, clear } = useAuth.getState();
  if (!refreshToken || !user) return false;

  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clear();
        return false;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setSession({ user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  const token = useAuth.getState().accessToken;
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${BASE}${path}`, { ...init, headers });
}

// Client fetch centralisé : injecte le Bearer token, gère le refresh auto sur 401,
// et parse le format d'erreur uniforme.
export async function api<T>(path: string, init: RequestInit = {}, _retried = false): Promise<T> {
  let res = await rawRequest(path, init);

  // Refresh transparent : sur 401 (hors endpoints d'auth), on tente un refresh puis un retry.
  if (res.status === 401 && !_retried && !path.startsWith('/auth/')) {
    const ok = await refreshSession();
    if (ok) res = await rawRequest(path, init);
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return body as T;
}
