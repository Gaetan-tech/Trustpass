# Manuel de mise à jour & maintenance — TrustPass (C2.4.1)

> Procédures pour **faire évoluer** l'application en toute sécurité : livraison d'une nouvelle
> version, synchronisation du schéma de base, mise à jour des dépendances, retour arrière.
> Public : équipe technique / mainteneur. Voir aussi `docs/DEPLOYMENT.md` (installation)
> et `docs/MANUEL_UTILISATEUR.md` (usage).

## 1. Versionnage

- Code versionné avec **Git**, branche de référence **`main`** (remote GitHub).
- Convention : **une branche par évolution** (`feat/…`, `fix/…`), fusionnée par **Pull Request**.
- Chaque PR déclenche la **CI** (`.github/workflows/ci.yml`) : lint, typecheck, tests, build.
  **Aucune fusion sur `main` sans CI verte.**
- Les versions applicatives suivent le **SemVer** (`MAJOR.MINOR.PATCH`) dans les `package.json`.

## 2. Cycle de mise à jour standard

```bash
# 1. Récupérer la dernière version
git checkout main && git pull origin main

# 2. Créer une branche de travail
git checkout -b feat/ma-fonctionnalite

# 3. Installer/mettre à jour les dépendances si package.json a changé
cd backend  && npm ci
cd ../frontend && npm ci

# 4. Développer, puis vérifier localement (mêmes étapes que la CI)
cd backend  && npm run lint && npm run typecheck && npm test
cd ../frontend && npm run lint && npm run typecheck && npm test && npm run build

# 5. Committer, pousser, ouvrir une PR
git add -A && git commit -m "feat: …"
git push -u origin feat/ma-fonctionnalite
```

Après **CI verte** et revue, fusionner la PR dans `main`.

## 3. Synchronisation du schéma de base (Prisma)

Le schéma est décrit dans `backend/prisma/schema.prisma`. Le projet synchronise ce schéma
avec la base via **`prisma db push`** (pas de dossier de migrations versionnées à ce stade).

**En développement / déploiement** (appliquer le schéma à la base de l'environnement) :
```bash
cd backend
npx prisma db push        # crée/aligne les tables sur le schéma
npx prisma generate       # régénère le client Prisma
```
C'est également ce que fait l'initContainer `db-migrate` des déploiements Kubernetes
(`infra/k8s/base/backend.yaml`).

> ⚠️ **Toujours sauvegarder la base avant un `db push` en production** (`pg_dump`).
> `db push` peut être destructif si le schéma retire des colonnes : vérifier le diff annoncé.
>
> **Évolution recommandée** : passer à des **migrations versionnées** (`prisma migrate dev`
> en développement → `prisma migrate deploy` en production) dès qu'un historique de schéma
> reproductible est requis.

## 4. Mise à jour des dépendances

```bash
# Inspecter les mises à jour disponibles
npm outdated
# Mettre à jour dans les bornes du package.json
npm update
# Après toute mise à jour : rejouer la vérification complète
npm run lint && npm run typecheck && npm test && npm run build
```

- Traiter les **montées de version majeures** une par une, sur une branche dédiée.
- Vérifier `npm audit` et corriger les vulnérabilités (`npm audit fix`, sans `--force` par défaut).
- **Committer le `package-lock.json`** pour garantir des installations reproductibles (`npm ci`).

## 5. Livraison d'une nouvelle version (build)

```bash
# Backend
cd backend && npm ci && npx prisma generate && npm run build   # -> dist/
# Frontend
cd frontend && npm ci && npm run build                          # -> dist/ (statique)
```
- Le **frontend** (`frontend/dist`) est un site statique à servir derrière un CDN / serveur web.
- Le **backend** (`backend/dist`) se lance avec `npm start` (Node) ; il requiert Postgres, Redis
  et les variables d'environnement (voir `.env.example` et `docs/SECRETS.md`).
- Détails d'infrastructure : `docs/DEPLOYMENT.md`, `docs/INFRA.md`.

## 6. Variables d'environnement

- Ne **jamais** committer de secret : les fichiers `.env` sont ignorés par Git.
- Toute nouvelle variable doit être **ajoutée à `.env.example`** (backend et/ou frontend) et
  **validée** dans `backend/src/config/env.ts` (schéma Zod, fail-fast au démarrage).

## 7. Retour arrière (rollback)

- **Code** : `git revert <commit>` (préféré) puis nouvelle livraison ; ou redéploiement du build
  de la version précédente.
- **Base** : restaurer la sauvegarde prise avant la synchronisation du schéma. Prévoir un schéma
  inverse si la structure a changé de façon non rétrocompatible.
- Après rollback : **rejouer la recette** (`docs/CAHIER_DE_RECETTES.md`).

## 8. Checklist avant chaque mise en production

- [ ] CI verte sur `main` (lint, typecheck, tests, build).
- [ ] Recette rejouée (unitaire + intégration + E2E) au vert.
- [ ] Migrations testées sur une copie de la base + **sauvegarde effectuée**.
- [ ] `.env` de production à jour (nouvelles variables, secrets valides).
- [ ] `docs/KNOWN_ISSUES.md` relu (limitations/risques connus).
- [ ] Numéro de version incrémenté (SemVer) et changements résumés.
