import { test, expect } from '@playwright/test';

test.describe('Marketplace', () => {
  test('la page d\'accueil affiche le hero et la section des annonces', async ({ page }) => {
    await page.goto('/');

    // Hero concert + section marketplace (le stock d'annonces dépend de l'état de la base).
    await expect(page.getByRole('heading', { name: /Vis le concert/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billets en revente' })).toBeVisible();
  });
});
