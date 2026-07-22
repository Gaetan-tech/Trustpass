// Capture les 4 figures du dossier depuis l'app en marche (localhost:5173),
// via Playwright (déjà présent dans le projet). Sortie : ../captures/*.png
// Prérequis : stack lancée (docker compose up -d) + backend :3000 + front :5173, base seedée.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'captures');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Connexion (organisateur : accès marketplace, vendre, dashboard, maquette)
await page.goto(`${BASE}/login`);
await page.getByLabel('Email').fill('organizer@trustpass.dev');
await page.getByLabel('Mot de passe').fill('password123');
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.waitForURL(`${BASE}/`);

const shot = async (name) => {
  await page.waitForTimeout(2500); // laisse finir les animations d'entrée + images
  await page.screenshot({ path: join(OUT, name), fullPage: false });
  console.log('OK', name);
};

// Fig. 1 — Marketplace
await page.goto(`${BASE}/`);
await shot('fig1-marketplace.png');

// Fig. 2 — Vendre
await page.goto(`${BASE}/sell`);
await shot('fig2-vendre.png');

// Fig. 3 — Dashboard organisateur
await page.goto(`${BASE}/organizer`);
await shot('fig3-dashboard-organisateur.png');

// Fig. 4 — Maquette de billet
await page.goto(`${BASE}/mockup`);
await page.waitForTimeout(1200);
await page.getByLabel('Événement').selectOption({ index: 1 });
await page.getByPlaceholder('ex. Camille Dupont').fill('Camille Dupont');
await page.getByPlaceholder(/ex\. TP/).fill('TP.7Y54-LR9U');
await shot('fig4-maquette.png');

await browser.close();
console.log('Figures écrites dans', OUT);
