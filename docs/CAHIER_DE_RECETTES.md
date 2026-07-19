# Cahier de recettes & plan de correction des anomalies (C2.3)

> Ce document formalise les **scénarios de test** (données, étapes, **résultat attendu**),
> leur **couverture automatisée**, et le **protocole de gestion des anomalies**.

## 1. Stratégie de recette

La recette de TrustPass repose sur **trois niveaux automatisés** rejouables à volonté :

| Niveau | Outil | Portée | Commande |
|--------|-------|--------|----------|
| Unitaire | Vitest | Fonctions/état isolés | `npm test` (front & back) |
| Intégration | Vitest + Testcontainers | Tunnel achat→transfert avec **vraie** base Postgres + Redis éphémères | `npm run test:integration` (back) |
| Bout-en-bout (E2E) | Playwright | Parcours utilisateurs réels via l'UI | `npm run test:e2e` (front) |

Chaque scénario ci-dessous est **exécuté automatiquement** ; la colonne « Spec » pointe le test qui en fait foi.

## 2. Scénarios de recette (E2E)

| # | Scénario | Préconditions / données | Étapes | Résultat attendu | Spec |
|---|----------|--------------------------|--------|------------------|------|
| R1 | Chargement marketplace | Base seedée | Ouvrir `/` | Hero + section annonces visibles | `e2e/smoke.spec.ts` |
| R2 | Connexion valide | `buyer@trustpass.dev` | Se connecter | Nav authentifiée + email affichés | `e2e/auth.spec.ts` |
| R3 | Connexion invalide | Mauvais mot de passe | Se connecter | Message d'erreur « identifiants incorrects » | `e2e/auth.spec.ts` |
| R4 | Achat bloqué si non connecté | Visiteur | Cliquer « Acheter » | Redirection vers la connexion | `e2e/guest-checkout.spec.ts` |
| R5 | **Achat → paiement simulé → transfert** | Annonce active | Payer → Confirmer | Billet **transféré**, nouveau QR, « Achat confirmé » | `e2e/purchase.spec.ts` |
| R6 | Transfert nominatif | Billet possédé | Renseigner destinataire | Billet transféré + email, ancien QR invalidé | `e2e/transfer.spec.ts` |
| R7 | Aperçu billet (photo de fond) | Billet possédé | Ouvrir « Aperçu » | Visuel billet avec photo événement + export PNG | `e2e/mytickets-preview.spec.ts` |
| R8 | Génération de maquette | — | Choisir événement | Maquette rendue + export PNG | `e2e/mockup.spec.ts` |
| R9 | Plafond de revente | Rôle organisateur | Fixer plafond 120 € | « Plafond mis à jour », valeur reflétée | `e2e/organizer.spec.ts` |
| R10 | Création/suppression événement | Rôle organisateur | Créer puis supprimer | Événement créé puis retiré | `e2e/organizer-events.spec.ts` |
| R11 | Édition événement | Rôle organisateur | Modifier | Modifications persistées | `e2e/organizer-edit.spec.ts` |
| R12 | Historique d'un billet | Rôle organisateur | Consulter | Historique/traçabilité affiché | `e2e/organizer-history.spec.ts` |
| R13 | Contrôle d'accès (scan) | Rôle contrôleur | Scanner un QR | Propriétaire + historique affichés | `e2e/scan.spec.ts` |

**Couverture invariants métier** (intégration) : `backend/tests/integration/tunnel.test.ts` valide
l'atomicité achat→transfert et la **rotation du QR** (ancien QR invalidé) — cœur du « trust layer ».

## 3. Exécution et critères d'acceptation

- **Critère de succès global** : `13/13` specs E2E vertes + tests unitaires + intégration au vert.
- **Exécution locale** : voir `docs/DEPLOYMENT.md` / `README.md` (stack Docker + seed, puis commandes ci-dessus).
- **Exécution automatique** : à chaque `push`/PR sur `main` via `.github/workflows/ci.yml`
  (lint, typecheck, tests unitaires, build). Les E2E/intégration nécessitent la stack complète
  et sont rejoués en local (voir §5).

## 4. Plan de correction des anomalies

Protocole appliqué à toute anomalie détectée (recette, CI, ou remontée utilisateur) :

1. **Qualification** — reproduire, isoler, classer par sévérité :
   - *Bloquant* : parcours d'achat/transfert cassé, faille de sécurité → correction immédiate.
   - *Majeur* : fonctionnalité dégradée sans contournement.
   - *Mineur* : cosmétique / confort.
2. **Traçage** — anomalie consignée dans `docs/KNOWN_ISSUES.md` (ou issue GitHub) : symptôme,
   étapes de repro, cause, statut.
3. **Test de non-régression d'abord** — écrire (ou étendre) un test qui **reproduit** le bug
   (unitaire ou E2E) et échoue.
4. **Correction** — implémenter le correctif jusqu'à faire passer ce test.
5. **Vérification** — relancer la suite complète ; la CI doit repasser au vert.
6. **Clôture** — mise à jour du statut dans `KNOWN_ISSUES.md` et de ce cahier si un scénario est ajouté.

### Limitations assumées (suivi)
Les limitations connues (ex. déploiement cloud non réalisé, audit lecteur d'écran à formaliser)
sont documentées dans `docs/KNOWN_ISSUES.md` et ne sont pas traitées comme des anomalies mais
comme du **périmètre différé**.

## 5. Rejouer la recette localement

```bash
# 1. Stack de dev (Postgres + Redis)
docker compose up -d
# 2. Backend : migrations + seed + serveur
cd backend && npx prisma db push && npm run seed && npm run dev
# 3. Front : serveur
cd frontend && npm run dev
# 4. Tests
cd backend  && npm test && npm run test:integration
cd frontend && npm test && npm run test:e2e
```
