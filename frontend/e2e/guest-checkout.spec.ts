import { test, expect } from '@playwright/test';
import { setupFreshListing } from './helpers';

// Un visiteur non connecté qui tente d'acheter est redirigé vers la connexion
// (au lieu de recevoir une erreur 401 sur POST /orders).
test('un visiteur non connecté est redirigé vers la connexion pour acheter', async ({ page, request }) => {
  const { eventId } = await setupFreshListing(request);
  await page.goto(`/events/${eventId}`);

  const buy = page.getByRole('button', { name: /Acheter le billet/ }).first();
  await expect(buy).toBeVisible();
  await buy.click();

  const modal = page.getByRole('dialog', { name: "Tunnel d'achat" });
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/Connecte-toi pour finaliser/i)).toBeVisible();

  await modal.getByRole('button', { name: 'Se connecter pour acheter' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
