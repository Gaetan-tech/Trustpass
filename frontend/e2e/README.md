# Tests E2E — Playwright

Parcours de bout en bout pilotés dans un vrai navigateur (Chromium) contre l'app réelle.

## Prérequis (pile complète en marche)

Les tests supposent le backend + la base seedés et l'API en mode **Stripe simulé**
(pas de `STRIPE_SECRET_KEY`, ce qui est le défaut de `.env.example`).

```bash
# 1) Services
docker compose up -d                       # Postgres + Redis

# 2) Backend (dans backend/)
npm run prisma:generate
npm run seed                               # organizer/seller/buyer/controller@trustpass.dev — password123
npm run dev                                # API sur http://localhost:3000

# 3) E2E (dans frontend/) — le front est démarré automatiquement par Playwright
npm run test:e2e                           # ou test:e2e:ui pour le mode interactif
```

> Le `webServer` de `playwright.config.ts` lance `npm run dev` (front :5173) et
> réutilise une instance déjà ouverte. Le backend, lui, doit tourner au préalable.

## Ce qui est couvert

| Spec | Parcours |
|------|----------|
| `smoke.spec.ts` | La marketplace charge (hero + annonces). |
| `auth.spec.ts` | Connexion acheteur + gestion d'un identifiant invalide. |
| `purchase.spec.ts` | Achat via l'UI → **paiement simulé** (Stripe décommissionné) → confirmation du transfert. |
| `organizer.spec.ts` | L'organisateur fixe le **plafond de revente** d'un événement. |
| `transfer.spec.ts` | **Transfert nominatif** d'un billet possédé vers une autre personne. |

## Notes

- Stripe est décommissionné : le paiement est simulé. Les tests confirment via
  `POST /orders/:id/simulate-pay` (endpoint buyer-scopé, refusé si Stripe est réactivé),
  ce qui joue le rôle du webhook `payment_intent.succeeded` en production (voir `helpers.ts`).
- Les tests s'exécutent en série (`workers: 1`) car ils partagent la base seedée.
- Variables surchargées possibles : `E2E_BASE_URL` (front), `E2E_API_URL` (backend).
