import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin, attachFreshTicket, firstEventId, loginUI } from './helpers';

// Aperçu d'un billet depuis « Mes billets » + export PNG.
test('aperçu d\'un billet depuis « Mes billets »', async ({ page, request }) => {
  const s = await apiLogin(request, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  const eventId = await firstEventId(request);
  await attachFreshTicket(request, s.accessToken, eventId);

  await loginUI(page, CREDENTIALS.buyer.email, CREDENTIALS.buyer.password);
  await page.goto('/tickets');

  await page.getByRole('button', { name: /Aperçu/ }).first().click();
  const modal = page.getByRole('dialog', { name: 'Aperçu du billet' });
  await expect(modal).toBeVisible();
  await expect(modal.locator('.ticket-svg svg')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    modal.getByRole('button', { name: /Télécharger en PNG/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
