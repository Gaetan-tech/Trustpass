import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin, createEventApi, loginUI } from './helpers';

// US-6.3 — l'organisateur modifie les détails d'un événement (nom, lieu, date).
test('l\'organisateur modifie un événement', async ({ page, request }) => {
  const orga = await apiLogin(request, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  const original = `E2E Edit ${Date.now()}`;
  await createEventApi(request, orga.accessToken, original);

  await loginUI(page, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  await page.goto('/organizer');
  await page.getByLabel('Événement').selectOption({ label: original });

  // Ouvre le formulaire d'édition et renomme l'événement.
  const renamed = `${original} — modifié`;
  await page.getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(renamed);
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();

  await expect(page.getByRole('status')).toContainText(/Événement mis à jour/i);
  await expect(page.getByLabel('Événement')).toContainText(renamed);
});
