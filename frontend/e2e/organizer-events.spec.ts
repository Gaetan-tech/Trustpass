import { test, expect } from '@playwright/test';
import { CREDENTIALS, loginUI } from './helpers';

// US-6.3 — l'organisateur crée un événement puis le supprime depuis l'UI.
test('l\'organisateur crée puis supprime un événement', async ({ page }) => {
  await loginUI(page, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  await page.goto('/organizer');

  const name = `E2E Event ${Date.now()}`;

  // Création
  await page.getByRole('button', { name: '+ Nouvel événement' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(name);
  await page.getByLabel('Date & heure').fill('2027-01-15T20:00');
  await page.getByRole('button', { name: "Créer l'événement" }).click();

  // Le nouvel événement est sélectionné dans le menu déroulant.
  const select = page.getByLabel('Événement');
  await expect(select).toContainText(name);

  // Suppression (aucun billet rattaché → autorisée), confirmation en deux temps.
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click();

  // L'événement ne doit plus figurer dans la liste.
  await expect(select).not.toContainText(name);
});
