import { defineConfig, devices } from '@playwright/test';

// E2E TrustPass. Prérequis (voir e2e/README.md) :
//   1) docker compose up -d           (Postgres + Redis)
//   2) backend : npm run seed && npm run dev   (API :3000, mode Stripe simulé)
//   3) front   : lancé automatiquement ci-dessous (webServer) ou déjà sur :5173
//
// Les tests pilotent l'UI et simulent le webhook Stripe via l'API (mode dev).
const FRONT_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // état partagé (DB seedée) → on garde l'ordre déterministe
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONT_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Démarre le front automatiquement ; réutilise une instance déjà lancée.
  webServer: {
    command: 'npm run dev',
    url: FRONT_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
