# TrustPass — Frontend

React 18 + Vite + TypeScript + React Query + Zustand + TailwindCSS + Framer Motion.
Contrats : [../docs/FRONT_CONTRACT.md](../docs/FRONT_CONTRACT.md), [../docs/API_CONTRACT.md](../docs/API_CONTRACT.md), [../docs/USER_FLOWS.md](../docs/USER_FLOWS.md).

## Démarrage

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:5173  (proxy /api -> backend :3000)
```

## Structure

```
src/
├── lib/            api.ts (client fetch + Bearer), format.ts
├── store/          auth.ts (Zustand, persisté)
├── types/          api.ts (miroir d'API_CONTRACT)
├── features/       <domaine>/ hooks React Query + composants
│   └── listings/   useListings, ListingCard
├── pages/          MarketplacePage, MyTicketsPage
├── App.tsx         routes
└── main.tsx        providers (QueryClient, Router)
```

## État (M3)

- **Fait** : scaffold, client API typé, store auth, marketplace (liste d'annonces),
  **tunnel d'achat** (`CheckoutModal` : création d'ordre avec `Idempotency-Key` + polling du
  statut jusqu'au transfert), « mes billets », 1 test RTL.
  - **Espace vendeur** (`/sell`) : rattacher un billet + publier une annonce (avec mapping
    des erreurs plafond/fenêtre).
  - **Auth** (`/login`, `/register`) : connexion, inscription (auto-login), déconnexion,
    session persistée ; nav conditionnelle par rôle.
  - **Dashboard organisateur** (`/organizer`) : sélection d'événement + KPI (reventes, prix
    moyen, taux, annonces vendues) + activité récente.
  - **Scan contrôleur** (`/scan`) : validation d'un QR, verdict visuel (autorisé / motif de refus).
  - **Refresh auto du token** : sur `401`, le client API tente un refresh (un seul concurrent)
    puis rejoue la requête ; échec → session vidée.
- **À faire** : confirmation Stripe.js (`clientSecret`) en prod, scan caméra (au lieu de la
  saisie manuelle du QR).

## Scripts

`npm run dev | build | preview | lint | typecheck | test`
