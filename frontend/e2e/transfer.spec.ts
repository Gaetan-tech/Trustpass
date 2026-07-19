import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin, attachFreshTicket, firstEventId, loginUI } from './helpers';

// US-5.2 — transfert nominatif direct d'un billet possédé vers une autre personne.
// On prépare un billet `owned` frais via l'API, puis on le transfère depuis l'UI.
test('le propriétaire transfère son billet à un proche (don nominatif)', async ({ page, request }) => {
  const session = await apiLogin(request, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  const eventId = await firstEventId(request);
  await attachFreshTicket(request, session.accessToken, eventId);

  await loginUI(page, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  await page.goto('/tickets');

  // Ouvre le formulaire de transfert sur le premier billet possédé.
  const transferToggle = page.getByRole('button', { name: /Transférer à un proche/ }).first();
  await expect(transferToggle).toBeVisible();
  await transferToggle.click();

  await page.getByLabel('Nom du destinataire').fill('Camille Dupont');
  // Email inconnu → billet devient nominatif (pas de réassignation de compte).
  await page.getByLabel('Email du destinataire').fill(`camille-${Date.now()}@exemple.fr`);
  await page.getByRole('button', { name: 'Confirmer le transfert' }).click();

  await expect(page.getByRole('status')).toContainText(/Billet transféré à/i);
  await expect(page.getByRole('status')).toContainText(/Camille Dupont/);
});
