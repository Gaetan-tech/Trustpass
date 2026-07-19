import { test, expect } from '@playwright/test';
import { CREDENTIALS, loginUI } from './helpers';

// US-6.1 — l'organisateur sélectionne un événement et fixe le plafond de revente.
test('l\'organisateur fixe le plafond de revente d\'un événement', async ({ page }) => {
  await loginUI(page, CREDENTIALS.organizer.email, CREDENTIALS.organizer.password);
  await page.goto('/organizer');

  await expect(page.getByRole('heading', { name: 'Dashboard organisateur' })).toBeVisible();

  // Bloc « Plafond de revente » : on saisit une nouvelle valeur et on enregistre.
  const capInput = page.getByLabel('Plafond de revente en euros');
  await expect(capInput).toBeVisible();
  await capInput.fill('120');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('status')).toContainText(/Plafond mis à jour/i);
  // La valeur « Actuel » reflète le nouveau plafond.
  await expect(page.getByText(/Actuel/)).toContainText('120,00');
});
