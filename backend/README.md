# TrustPass — Backend

Express + TypeScript + Prisma (PostgreSQL) + Redis + Stripe Connect. Voir contrats : [../docs/API_CONTRACT.md](../docs/API_CONTRACT.md), [../docs/DB_SCHEMA.md](../docs/DB_SCHEMA.md), [../docs/BACK_CONTRACT.md](../docs/BACK_CONTRACT.md).

## Démarrage

```bash
cp .env.example .env      # renseigner DATABASE_URL, REDIS_URL, secrets
npm install
npm run prisma:generate
npm run prisma:migrate    # crée les tables (ajouter l'index partiel, cf. schema.prisma)
npm run dev               # http://localhost:3000/health
```

## Structure (architecture en couches)

```
src/
├── config/env.ts            # validation env (Zod), fail-fast
├── lib/                     # prisma, redis, logger, errors, helpers
├── middleware/              # auth (JWT + RBAC), errorHandler
├── modules/<domaine>/       # routes → controller → service (→ repository)
│   ├── auth/                # ✅ implémenté (register/login/refresh/me)
│   ├── events/  tickets/    # ⬜ routers stubs (501) à implémenter (M3)
│   ├── listings/  orders/   # ⬜
│   └── webhooks/            # ⬜ Stripe (source de vérité paiement)
├── routes.ts                # montage /api/v1
├── app.ts                   # app Express (helmet, cors, raw body webhook)
└── index.ts                 # bootstrap
```

## État (M3)

- **Fait** : bootstrap, config, middlewares, gestion d'erreurs, RBAC, schéma Prisma.
  - Module `auth` complet (register/login/refresh/me).
  - **Tunnel de revente complet** : `listings` (publish avec plafond+fenêtre / withdraw / list),
    `orders` (réservation verrou Redis + Stripe intent + idempotence), `webhooks/stripe`
    (idempotent → **transfert atomique** de propriété + rotation QR), règles organisateur, audit log.
  - Mode Stripe **simulé** si `STRIPE_SECRET_KEY` absent (tunnel testable sans compte Stripe).
  - Seed de démo : `npm run seed` (organizer/seller/buyer @trustpass.dev — `password123`).
  - Module `events` : liste/détail publics, création + upsert des règles (organisateur).
  - Module `tickets` : `attach` (idempotent via `external_ref`), `me`, détail, **validate QR**
    (contrôleur, verdict en 200 + passage `used`).
  - Module `organizer` : `GET /organizer/events` + `GET /organizer/events/:id/stats` (US-8.1).
  - Auth : `POST /auth/logout` (révocation du refresh token).
  - **Worker `reservationReaper`** : libère en base les réservations expirées (filet de
    sécurité du TTL Redis), démarré depuis `index.ts`.
  - **Emails transactionnels** : queue **BullMQ** (`notifications`) + worker Resend
    (mode dev = emails loggés). Branchés sur inscription, vente, achat confirmé, échec paiement.
  - **Tests d'intégration** (testcontainers Postgres + Redis) : tunnel complet, double
    réservation, plafond de prix — voir `test:integration`.
- **À faire** : OpenAPI généré depuis Zod.

## Tester le tunnel en local

```bash
npm run prisma:migrate && npm run seed
npm run dev
# 1) login buyer -> POST /api/v1/auth/login
# 2) GET /api/v1/listings  (l'annonce seedée apparaît)
# 3) POST /api/v1/orders  (header Idempotency-Key: <uuid>, body { listingId })  -> pending + clientSecret
# 4) simuler le paiement (mode dev) via POST /api/v1/webhooks/stripe :
#    { "id":"evt_1","type":"payment_intent.succeeded","data":{"object":{"metadata":{"orderId":"<id>"}}} }
# 5) GET /api/v1/orders/<id>  -> transferred + newQr
```

## Tests d'intégration (Docker requis)

Le tunnel complet (achat → webhook → transfert atomique + rotation QR, double-réservation,
plafond de prix) est testé sur **Postgres + Redis réels** via testcontainers.

```bash
# Docker Desktop doit tourner. Ryuk parfois capricieux sous Windows -> on le désactive.
TESTCONTAINERS_RYUK_DISABLED=true npm run test:integration
```

Fichier : `tests/integration/tunnel.test.ts` (schéma appliqué via `prisma db push` dans une
base éphémère, conteneurs arrêtés en `afterAll`).

## Scripts

`npm run dev | build | start | lint | typecheck | test | test:integration | prisma:migrate | seed`
