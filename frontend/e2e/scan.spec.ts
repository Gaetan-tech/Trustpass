import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin, attachFreshTicket, firstEventId, loginUI, ticketQr } from './helpers';

// US-7.2 — au contrôle d'accès, le scan affiche le propriétaire et l'historique des possesseurs.
test('le scan affiche le propriétaire et l\'historique du billet', async ({ page, request }) => {
  // Prépare un billet frais possédé par le buyer et récupère son QR.
  const session = await apiLogin(request, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  const eventId = await firstEventId(request);
  const ticketId = await attachFreshTicket(request, session.accessToken, eventId);
  const qr = await ticketQr(request, session.accessToken, ticketId);

  // Contrôleur : scanne le QR.
  await loginUI(page, CREDENTIALS.controller.email, CREDENTIALS.controller.password);
  await page.goto('/scan');
  await page.getByLabel('Code QR scanné').fill(qr);
  await page.getByRole('button', { name: 'Valider' }).click();

  await expect(page.getByText('Accès autorisé')).toBeVisible();
  // Propriétaire + historique visibles.
  await expect(page.getByText('Propriétaire du billet')).toBeVisible();
  await expect(page.getByText('Historique des possesseurs')).toBeVisible();
  await expect(page.getByText(CREDENTIALS.buyer.email).last()).toBeVisible();
});
