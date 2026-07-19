import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin, attachFreshTicket, createEventApi, loginUI } from './helpers';

// US-8.2 — l'organisateur consulte l'historique de possession d'un billet de son événement.
test('l\'organisateur consulte l\'historique d\'un billet', async ({ page, request }) => {
  // Événement de l'organisateur + un billet rattaché par le buyer (→ historique non vide).
  const orga = await apiLogin(request, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  const eventName = `E2E Histo ${Date.now()}`;
  const eventId = await createEventApi(request, orga.accessToken, eventName);
  const buyer = await apiLogin(request, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  await attachFreshTicket(request, buyer.accessToken, eventId);

  await loginUI(page, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  await page.goto('/organizer');

  // Sélectionne l'événement créé.
  await page.getByLabel('Événement').selectOption({ label: eventName });

  // Section « Billets & historique » : déplie le billet et vérifie l'entrée d'émission.
  await expect(page.getByRole('heading', { name: 'Billets & historique' })).toBeVisible();
  await page.getByText(CREDENTIALS.buyer.email).first().click();
  await expect(page.getByText('Émission')).toBeVisible();
});
