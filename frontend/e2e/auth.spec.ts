import { test, expect } from '@playwright/test';
import { CREDENTIALS, loginUI } from './helpers';

test.describe('Authentification', () => {
  test('un acheteur peut se connecter et voir la nav authentifiée', async ({ page }) => {
    await loginUI(page, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);

    await expect(page.getByText(CREDENTIALS.buyer.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeVisible();
    // Scopé au header : « Vendre » existe aussi dans le footer inversé.
    await expect(page.getByRole('banner').getByRole('link', { name: 'Vendre' })).toBeVisible();
  });

  test('des identifiants invalides affichent une erreur', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('buyer@trustpass.dev');
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toContainText(/incorrect/i);
  });
});
