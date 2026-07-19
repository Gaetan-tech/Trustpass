import { test, expect } from '@playwright/test';
import { CREDENTIALS, loginUI, setupFreshListing } from './helpers';

// Stripe décommissionné → paiement simulé. « Payer » réserve l'annonce, puis
// « Confirmer le paiement » valide (aucun débit réel) et déclenche le transfert.
test('achat d\'une annonce → paiement simulé → billet transféré', async ({ page, request }) => {
  const { eventId } = await setupFreshListing(request);

  await loginUI(page, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  await page.goto(`/events/${eventId}`);

  const buyButton = page.getByRole('button', { name: /Acheter le billet/ }).first();
  await expect(buyButton).toBeVisible();
  await buyButton.click();

  const modal = page.getByRole('dialog', { name: "Tunnel d'achat" });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Payer' }).click();

  // Étape de paiement simulé : on confirme explicitement.
  await modal.getByRole('button', { name: 'Confirmer le paiement' }).click();

  // Le transfert est déclenché → message de succès (polling de l'état de commande).
  await expect(modal.getByText(/Achat confirmé/)).toBeVisible({ timeout: 15_000 });
});
