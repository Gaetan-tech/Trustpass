# Déploiement Azure — Static Web Apps + Container Apps

Alternative **serverless / cost-minimal** à l'AKS de `infra/` (Terraform + K8s).
Recommandée pour une démo / un budget d'essai : pas de cluster à gérer.

```
Frontend  → Azure Static Web Apps   (SPA statique, CDN mondial, SSL gratuit — Free tier)
Backend   → Azure Container Apps     (image Docker, ingress HTTPS, min 1 replica*)
Redis     → sidecar redis:7-alpine    (dans le Container App backend, localhost:6379)
Postgres  → PostgreSQL Flexible Server (Burstable B1ms, managé + sauvegardes)
```

Redis tourne **en sidecar du backend** (même Container App) : le backend le joint
via `localhost:6379`. Ce choix évite le TCP inter-app (l'ingress interne ACA s'est
révélé injoignable — `ETIMEDOUT`) et le coût d'un service managé. Sans persistance,
ce qui convient aux verrous et à la file BullMQ d'une démo.

\* `minReplicas=1` : le backend héberge des **workers in-process** (reaper de réservations +
file BullMQ). Un scale-to-zero les arrêterait → on garde 1 réplica chaud.

## Prérequis
- `az` CLI connecté (`az login`) sur un abonnement actif.
- `node` / `npm` et **Docker** (l'image backend est buildée localement puis poussée sur l'ACR ;
  `az acr build` est évité car son streaming de logs plante sur Windows/cp1252).

## Lancer
```bash
bash infra/azure/deploy.sh
```
Le script est **idempotent** (relançable). Il :
1. enregistre les resource providers,
2. crée RG + ACR et builde/pousse l'image backend (Docker local),
3. provisionne Postgres Flexible Server,
4. crée l'environnement Container Apps + l'app backend **avec le sidecar Redis** (secrets injectés),
5. applique le schéma Prisma (`db push`) + le `seed` de démo,
6. builde le frontend avec la bonne `VITE_API_BASE_URL` et le déploie sur SWA,
7. restreint le `CORS_ORIGIN` du backend à l'URL du SWA.

## Veille / réveil / monitoring
- `bash infra/azure/pause.sh` — met en veille (stop Postgres + backend à 0 réplica).
- `bash infra/azure/resume.sh` — réveille (start Postgres + backend à 1 réplica).
- `bash infra/azure/monitoring.sh` — Azure Monitor (App Insights, test /health, alertes).

Surcharge possible via variables d'env : `LOCATION`, `RG`, `SUFFIX`, `SWA_NAME`, etc.

## Secrets
Mots de passe / clés JWT générés une fois et conservés dans
`infra/azure/.deploy-state.env` (git-ignoré). Ne pas committer.

## Démonter (arrêter les coûts)
```bash
az group delete -n trustpass-rg --yes --no-wait
```
