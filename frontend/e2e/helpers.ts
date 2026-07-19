import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// URL de l'API backend (mode Stripe simulé). Surchargée par E2E_API_URL en CI.
export const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1';

export const CREDENTIALS = {
  buyer: { email: 'buyer@trustpass.dev', password: 'password123' },
  seller: { email: 'seller@trustpass.dev', password: 'password123' },
  organizer: { email: 'organizer@trustpass.dev', password: 'password123' },
  controller: { email: 'controller@trustpass.dev', password: 'password123' },
};

interface Session {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

// --- Helpers API (setup rapide / simulation paiement) ---------------------

export async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<Session> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } });
  expect(res.ok(), `login API ${email}`).toBeTruthy();
  return res.json();
}

export async function firstEventId(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${API}/events`);
  expect(res.ok(), 'GET /events').toBeTruthy();
  const body = await res.json();
  expect(body.data.length, 'au moins un événement seedé').toBeGreaterThan(0);
  return body.data[0].id as string;
}

// Rattache un billet frais au buyer (attach idempotent) → billet `owned` prêt à transférer.
export async function attachFreshTicket(
  request: APIRequestContext,
  token: string,
  eventId: string,
): Promise<string> {
  const ref = `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post(`${API}/tickets/attach`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { eventId, ticketRef: ref },
  });
  expect(res.ok(), `attach ticket (${await res.text()})`).toBeTruthy();
  return (await res.json()).id as string;
}

// Récupère le QR courant d'un billet possédé (pour le scanner au contrôle).
export async function ticketQr(request: APIRequestContext, token: string, ticketId: string): Promise<string> {
  const res = await request.get(`${API}/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), 'GET /tickets/:id').toBeTruthy();
  return (await res.json()).qrCode as string;
}

// Crée un événement via l'API (organisateur) → renvoie son id.
export async function createEventApi(request: APIRequestContext, token: string, name: string): Promise<string> {
  const res = await request.post(`${API}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, venue: 'Salle E2E', startsAt: new Date(Date.now() + 30 * 86400000).toISOString() },
  });
  expect(res.ok(), `create event (${await res.text()})`).toBeTruthy();
  return (await res.json()).id as string;
}

// Crée une annonce fraîche et déterministe (indépendante du seed, pour ne pas l'épuiser) :
// événement + règle de plafond (organisateur), rattachement + publication (vendeur).
export async function setupFreshListing(
  request: APIRequestContext,
): Promise<{ eventId: string; eventName: string; listingId: string }> {
  const orga = await apiLogin(request, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  const eventName = `E2E Vente ${Date.now()}`;
  const eventId = await createEventApi(request, orga.accessToken, eventName);

  const rule = await request.put(`${API}/events/${eventId}/rules`, {
    headers: { Authorization: `Bearer ${orga.accessToken}` },
    data: { priceCap: 10000 }, // plafond 100 €
  });
  expect(rule.ok(), `set rule (${await rule.text()})`).toBeTruthy();

  const seller = await apiLogin(request, CREDENTIALS.seller.email, CREDENTIALS.seller.password);
  const ticketId = await attachFreshTicket(request, seller.accessToken, eventId);
  const listing = await request.post(`${API}/listings`, {
    headers: { Authorization: `Bearer ${seller.accessToken}` },
    data: { ticketId, price: 5000 }, // 50 € < plafond
  });
  expect(listing.ok(), `publish listing (${await listing.text()})`).toBeTruthy();

  return { eventId, eventName, listingId: (await listing.json()).id as string };
}

// Confirme un paiement simulé (Stripe décommissionné). Appelle l'endpoint dédié
// buyer-scopé — équivalent de ce que Stripe déclencherait en prod.
export async function simulatePayment(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<void> {
  const res = await request.post(`${API}/orders/${orderId}/simulate-pay`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `simulate-pay (${await res.text()})`).toBeTruthy();
}

// Récupère l'ID de la dernière commande `pending` de l'acheteur.
export async function latestPendingOrder(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${API}/orders/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), 'GET /orders/mine').toBeTruthy();
  const body = await res.json();
  const pending = body.data.find((o: { status: string }) => o.status === 'pending');
  expect(pending, 'une commande pending existe').toBeTruthy();
  return pending.id as string;
}

// --- Helpers UI -----------------------------------------------------------

export async function loginUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // La nav authentifiée affiche « Mes billets ».
  await expect(page.getByRole('link', { name: 'Mes billets' })).toBeVisible();
}
