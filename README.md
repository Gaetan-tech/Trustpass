# TrustPass

**Plateforme de revente sécurisée de billets d'événements.** Prix plafonné par l'organisateur,
transfert de propriété atomique avec **rotation du QR** (l'ancien billet devient invalide),
traçabilité complète — un « trust layer » pour la seconde main événementielle.

- **Frontend** : React 18 + Vite + TypeScript + Tailwind (thème noir sur blanc, accent violet).
- **Backend** : Node + Express + Prisma + PostgreSQL + Redis.
- **Paiement** : **mode simulé** (Stripe décommissionné — aucun débit réel).

---

## 🚀 Lancer l'application en local

### Prérequis
- **Node.js ≥ 20** et **npm**
- **Docker Desktop** (pour PostgreSQL + Redis)

### 1. Base de données & cache (Docker)
Depuis la racine du projet :
```bash
docker compose up -d
```
Cela démarre **PostgreSQL** (port `5432`) et **Redis** (port `6381`).

### 2. Backend (API)
```bash
cd backend
npm install

# Créer le fichier d'environnement à partir de l'exemple
cp .env.example .env          # PowerShell : Copy-Item .env.example .env
```
Édite `backend/.env` avec **au minimum** :
```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trustpass?schema=public"
REDIS_URL="redis://localhost:6381"        # ⚠️ 6381 (mapping docker-compose)
JWT_SECRET="dev-secret-change-me-1234567890"       # ≥ 16 caractères
JWT_REFRESH_SECRET="dev-refresh-change-me-1234567890"
STRIPE_SECRET_KEY=""                       # vide = paiement simulé
CORS_ORIGIN="http://localhost:5173"
```
Puis initialise le schéma, insère les données de démo et démarre l'API :
```bash
npx prisma db push     # crée les tables
npm run seed           # comptes + événements de démonstration
npm run dev            # API sur http://localhost:3000
```

### 3. Frontend (SPA)
Dans un **second terminal** :
```bash
cd frontend
npm install
cp .env.example .env   # facultatif (les valeurs par défaut suffisent)
npm run dev            # app sur http://localhost:5173
```

### 4. Ouvrir l'application
👉 **http://localhost:5173**

---

## 👤 Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Acheteur | `buyer@trustpass.dev` | `password123` |
| Vendeur | `seller@trustpass.dev` | `password123` |
| Organisateur | `organizer@trustpass.dev` | `password123` |
| Contrôleur | `controller@trustpass.dev` | `password123` |

**Tester un achat** : se connecter en acheteur → « Acheter » sur une annonce → « Payer » →
« Confirmer le paiement » (simulé) → le billet arrive dans « Mes billets ».

---

## 🧪 Tests & qualité

```bash
# Backend
cd backend
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # tests unitaires (Vitest)
npm run test:integration   # tunnel achat→transfert (Testcontainers : Docker requis)

# Frontend
cd frontend
npm run lint          # ESLint + audit accessibilité (jsx-a11y)
npm run typecheck
npm test              # tests unitaires (Vitest)
npm run test:e2e      # bout-en-bout (Playwright) — stack complète requise
npm run build         # build de production
```

> La CI (`.github/workflows/ci.yml`) exécute lint + typecheck + tests + build à chaque push/PR.

---

## 📁 Structure du dépôt

```
backend/     API Express + Prisma (modules auth, events, listings, orders, tickets…)
frontend/    SPA React + Vite
infra/azure/ Déploiement live : Azure Static Web Apps + Container Apps (script + runbook)
infra/       Alternative AKS : Terraform + Kubernetes (Kustomize) — voir infra/README.md
docs/        Documentation (dont livrables : ACCESSIBILITE, CAHIER_DE_RECETTES, MANUELS)
docker-compose.yml   Postgres + Redis pour le dev local
```

---

## 🛠️ Dépannage

| Symptôme | Cause | Solution |
|----------|-------|----------|
| L'API refuse de démarrer | `.env` incomplet | JWT ≥ 16 car., `DATABASE_URL`/`REDIS_URL` valides |
| Rien ne s'affiche sur la marketplace | Backend non démarré | Vérifier `npm run dev` côté backend (port 3000) |
| Erreur de connexion DB/Redis | Conteneurs non lancés | `docker compose up -d` puis `docker compose ps` |
| Redis « connection refused » | Mauvais port | `REDIS_URL=redis://localhost:6381` (pas 6379) |

Arrêter la stack : `docker compose down` (ajouter `-v` pour effacer les données).

---

## ☁️ Déploiement

L'environnement **live** est hébergé sur Azure, en **serverless / cost-minimal** (pas de cluster à gérer) :

```
Frontend  → Azure Static Web Apps            (SPA statique, CDN mondial, SSL — Free tier)
Backend   → Azure Container Apps              (image Docker, ingress HTTPS, min 1 réplica*)
Redis     → sidecar redis:7-alpine           (dans le Container App backend, localhost:6379)
Postgres  → Azure PostgreSQL Flexible Server (Burstable B1ms, managé + sauvegardes)
```

> \* `minReplicas=1` : le backend héberge des **workers in-process** (reaper de réservations + file
> BullMQ) qu'un scale-to-zero arrêterait — on garde 1 réplica chaud.

**Démo en ligne** (peut être en veille pour maîtriser les coûts — cf. `pause.sh`/`resume.sh`) :
- Frontend : https://wonderful-water-06fe97f0f.7.azurestaticapps.net
- API : https://trustpass-api.wonderfulsea-3536033b.francecentral.azurecontainerapps.io

**Mise en place & CI/CD** :
- Provisionnement idempotent : `bash infra/azure/deploy.sh` — runbook complet dans **[`infra/azure/README.md`](infra/azure/README.md)**.
- Déploiement continu : `.github/workflows/cd.yml` déploie `main` vers cette infra (build image → ACR →
  `containerapp update`, puis build + déploiement SWA). Inactif tant que la variable de dépôt
  `AZURE_DEPLOY_ENABLED` n'est pas à `true`.

> **Alternative AKS** (Terraform + Kubernetes, 3 environnements staging/preprod/prod, plus proche d'une
> cible production mais avec un cluster à gérer) : décrite dans **[`infra/README.md`](infra/README.md)**.
