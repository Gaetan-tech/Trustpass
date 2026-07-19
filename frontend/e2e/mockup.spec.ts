import { test, expect } from '@playwright/test';

// Maquette de billet : aperçu en direct + export PNG.
test('la maquette de billet s\'affiche et s\'exporte en PNG', async ({ page }) => {
  await page.goto('/mockup');
  await expect(page.getByRole('heading', { name: 'Maquette de billet' })).toBeVisible();

  // L'aperçu SVG est rendu.
  await expect(page.locator('.ticket-svg svg')).toBeVisible();

  // Choisir un événement du marketplace met à jour l'aperçu.
  await page.getByLabel('Événement').selectOption({ index: 1 });
  await page.getByLabel('Nom du porteur').fill('Camille E2E');

  // Le téléchargement PNG se déclenche.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Télécharger en PNG/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
