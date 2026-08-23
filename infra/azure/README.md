# Déploiement Azure — Static Web Apps + Container Apps

Alternative **serverless / cost-minimal** à l'AKS de `infra/` (Terraform + K8s).
Recommandée pour une démo / un budget d'essai : pas de cluster à gérer.

```
Frontend  → Azure Static Web Apps   (SPA statique, CDN mondial, SSL gratuit — Free tier)
Backend   → Azure Container Apps     (image Docker, ingress HTTPS, min 1 replica*)
Postgres  → PostgreSQL Flexible Server (Burstable B1ms, managé + sauvegardes)
Redis     → Azure Cache for Redis     (Basic C0, TLS 6380)
```

\* `minReplicas=1` : le backend héberge des **workers in-process** (reaper de réservations +
file BullMQ). Un scale-to-zero les arrêterait → on garde 1 réplica chaud.

## Prérequis
- `az` CLI connecté (`az login`) sur un abonnement actif.
- `node` / `npm`. **Docker n'est pas requis** (l'image est buildée à distance par `az acr build`).

## Lancer
```bash
bash infra/azure/deploy.sh
```
Le script est **idempotent** (relançable). Il :
1. enregistre les resource providers,
2. crée RG + ACR et builde/pousse l'image backend,
3. provisionne Postgres Flexible Server + Redis,
4. crée l'environnement Container Apps + l'app backend (secrets injectés),
5. applique le schéma Prisma (`db push`) + le `seed` de démo,
6. builde le frontend avec la bonne `VITE_API_BASE_URL` et le déploie sur SWA,
7. restreint le `CORS_ORIGIN` du backend à l'URL du SWA.

Surcharge possible via variables d'env : `LOCATION`, `RG`, `SUFFIX`, `SWA_NAME`, etc.

## Secrets
Mots de passe / clés JWT générés une fois et conservés dans
`infra/azure/.deploy-state.env` (git-ignoré). Ne pas committer.

## Démonter (arrêter les coûts)
```bash
az group delete -n trustpass-rg --yes --no-wait
```
