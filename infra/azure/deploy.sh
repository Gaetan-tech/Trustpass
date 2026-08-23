#!/usr/bin/env bash
# =============================================================================
# TrustPass — Déploiement Azure "serverless" : Static Web Apps + Container Apps
#   Frontend  -> Azure Static Web Apps  (SPA statique, CDN, SSL gratuit)
#   Backend   -> Azure Container Apps   (image Docker, ingress HTTPS, min 1 replica)
#   Postgres  -> Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
#   Redis     -> Azure Cache for Redis  (Basic C0, TLS)
#
# Idempotent : chaque ressource est créée si absente. Relançable sans casse.
# Prérequis  : az (connecté via `az login`), node/npm. Docker PAS requis
#              (l'image est buildée à distance par `az acr build`).
# Usage      : bash infra/azure/deploy.sh
# =============================================================================
set -euo pipefail

# Force UTF-8 pour l'az CLI (évite le crash 'charmap'/cp1252 sur Windows quand
# les logs de build distant contiennent des caractères Unicode, ex. ✔).
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

# ---- Paramètres (surchargez via variables d'environnement si besoin) --------
LOCATION="${LOCATION:-westeurope}"
RG="${RG:-trustpass-rg}"
# Suffixe déterministe (basé sur l'abonnement) pour les noms globalement uniques
SUB_ID="$(az account show --query id -o tsv)"
SUFFIX="${SUFFIX:-$(printf '%s' "$SUB_ID" | tr -d '-' | cut -c1-6)}"

ACR="${ACR:-trustpassacr${SUFFIX}}"
PG_SERVER="${PG_SERVER:-trustpass-pg-${SUFFIX}}"
PG_DB="trustpass"
PG_ADMIN="${PG_ADMIN:-tpadmin}"
REDIS_NAME="${REDIS_NAME:-trustpass-redis-${SUFFIX}}"
ACA_ENV="${ACA_ENV:-trustpass-env}"
API_APP="${API_APP:-trustpass-api}"
SWA_NAME="${SWA_NAME:-trustpass-web-${SUFFIX}}"
# Static Web Apps n'existe que dans quelques régions (pas francecentral) :
# centralus, eastus2, westus2, westeurope, eastasia. Sans impact (CDN mondial).
SWA_LOCATION="${SWA_LOCATION:-eastus2}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ---- Secrets (générés si non fournis, réutilisés si déjà présents) ----------
STATE_FILE="${REPO_ROOT}/infra/azure/.deploy-state.env"
if [[ -f "$STATE_FILE" ]]; then
  echo "↻  Réutilisation des secrets existants ($STATE_FILE)"
  # shellcheck disable=SC1090
  source "$STATE_FILE"
fi
PG_PASSWORD="${PG_PASSWORD:-$(openssl rand -hex 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}"
mkdir -p "${REPO_ROOT}/infra/azure"
cat > "$STATE_FILE" <<EOF
PG_PASSWORD=$PG_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
EOF
chmod 600 "$STATE_FILE" 2>/dev/null || true

urlenc() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }
step() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

echo "Souscription : $SUB_ID"
echo "Région       : $LOCATION | RG: $RG | suffixe: $SUFFIX"

# ---- 0. Providers -----------------------------------------------------------
step "0/9 Enregistrement des resource providers"
for p in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry \
         Microsoft.DBforPostgreSQL Microsoft.Cache Microsoft.Web; do
  state=$(az provider show -n "$p" --query registrationState -o tsv 2>/dev/null || echo NotRegistered)
  [[ "$state" == "Registered" ]] || az provider register -n "$p" --wait
done
az extension add --name containerapp --upgrade --only-show-errors 2>/dev/null || true

# ---- 1. Resource Group ------------------------------------------------------
step "1/9 Resource Group"
az group create -n "$RG" -l "$LOCATION" -o none

# ---- 2. ACR + build image backend ------------------------------------------
# NB : build LOCAL via Docker puis push (au lieu de `az acr build`, dont le
# streaming de logs plante sur Windows/cp1252 — bug colorama).
step "2/9 Azure Container Registry + build de l'image backend (Docker local)"
az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null || \
  az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none
ACR_SERVER="$(az acr show -n "$ACR" -g "$RG" --query loginServer -o tsv)"
ACR_USER="$(az acr credential show -n "$ACR" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR" --query 'passwords[0].value' -o tsv)"
echo "$ACR_PASS" | docker login "$ACR_SERVER" -u "$ACR_USER" --password-stdin
docker build \
  -t "${ACR_SERVER}/trustpass-backend:${IMAGE_TAG}" \
  -t "${ACR_SERVER}/trustpass-backend:latest" \
  -f "${REPO_ROOT}/backend/Dockerfile" "${REPO_ROOT}/backend"
docker push "${ACR_SERVER}/trustpass-backend:${IMAGE_TAG}"
docker push "${ACR_SERVER}/trustpass-backend:latest"

# ---- 3. PostgreSQL Flexible Server -----------------------------------------
step "3/9 PostgreSQL Flexible Server (B1ms)"
if ! az postgres flexible-server show -n "$PG_SERVER" -g "$RG" -o none 2>/dev/null; then
  az postgres flexible-server create \
    -n "$PG_SERVER" -g "$RG" -l "$LOCATION" \
    --tier Burstable --sku-name Standard_B1ms \
    --storage-size 32 --version 16 \
    --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
    --public-access Enabled --yes -o none
fi
# La base applicative (créée à part : --database-name n'est plus supporté par create)
az postgres flexible-server db create -g "$RG" -s "$PG_SERVER" -d "$PG_DB" -o none 2>/dev/null || true
# Autoriser les services Azure (Container Apps) : plage 0.0.0.0
az postgres flexible-server firewall-rule create -g "$RG" -s "$PG_SERVER" \
  -n AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none 2>/dev/null || true
# Autoriser l'IP publique de CETTE machine (pour prisma db push + seed)
MYIP="$(curl -s https://api.ipify.org || echo '')"
if [[ -n "$MYIP" ]]; then
  az postgres flexible-server firewall-rule create -g "$RG" -s "$PG_SERVER" \
    -n DeployClient --start-ip-address "$MYIP" --end-ip-address "$MYIP" -o none 2>/dev/null || true
fi
PG_HOST="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RG" --query fullyQualifiedDomainName -o tsv)"
DATABASE_URL="postgresql://${PG_ADMIN}:$(urlenc "$PG_PASSWORD")@${PG_HOST}:5432/${PG_DB}?sslmode=require"

# ---- 4. Container Apps Environment + Redis interne --------------------------
# Azure Cache for Redis est en retrait pour les nouveaux comptes, et Azure Managed
# Redis est disproportionné (coût) pour une démo. On fait tourner Redis comme
# Container App INTERNE (TCP) dans le même environnement : locks + file BullMQ
# n'exigent pas de persistance ici. Pas de TLS ni d'auth sur le réseau privé de l'env.
step "4/9 Container Apps Environment + Redis interne"
az containerapp env show -n "$ACA_ENV" -g "$RG" -o none 2>/dev/null || \
  az containerapp env create -n "$ACA_ENV" -g "$RG" -l "$LOCATION" -o none

if ! az containerapp show -n "$REDIS_NAME" -g "$RG" -o none 2>/dev/null; then
  az containerapp create \
    -n "$REDIS_NAME" -g "$RG" --environment "$ACA_ENV" \
    --image redis:7-alpine \
    --ingress internal --transport tcp --target-port 6379 --exposed-port 6379 \
    --min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi -o none
fi
REDIS_FQDN="$(az containerapp show -n "$REDIS_NAME" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
REDIS_URL="redis://${REDIS_FQDN}:6379"

# ---- 5. Backend (Container App) --------------------------------------------
step "5/9 Backend (Container App)"
# CORS_ORIGIN provisoire (mis à jour à l'étape 8 avec l'URL réelle du SWA)
if ! az containerapp show -n "$API_APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp create \
    -n "$API_APP" -g "$RG" --environment "$ACA_ENV" \
    --image "${ACR_SERVER}/trustpass-backend:${IMAGE_TAG}" \
    --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --target-port 3000 --ingress external \
    --min-replicas 1 --max-replicas 3 \
    --cpu 0.5 --memory 1.0Gi \
    --secrets database-url="$DATABASE_URL" redis-url="$REDIS_URL" \
             jwt-secret="$JWT_SECRET" jwt-refresh-secret="$JWT_REFRESH_SECRET" \
    --env-vars NODE_ENV=production PORT=3000 \
             DATABASE_URL=secretref:database-url REDIS_URL=secretref:redis-url \
             JWT_SECRET=secretref:jwt-secret JWT_REFRESH_SECRET=secretref:jwt-refresh-secret \
             STRIPE_SECRET_KEY= CORS_ORIGIN="*" \
    -o none
else
  az containerapp secret set -n "$API_APP" -g "$RG" \
    --secrets database-url="$DATABASE_URL" redis-url="$REDIS_URL" \
             jwt-secret="$JWT_SECRET" jwt-refresh-secret="$JWT_REFRESH_SECRET" -o none
  az containerapp update -n "$API_APP" -g "$RG" \
    --image "${ACR_SERVER}/trustpass-backend:${IMAGE_TAG}" -o none
fi
API_FQDN="$(az containerapp show -n "$API_APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
API_URL="https://${API_FQDN}"

# ---- 6. Schéma + données de démo (prisma db push + seed) --------------------
step "6/9 Migration du schéma + seed (depuis cette machine)"
(
  cd "${REPO_ROOT}/backend"
  export DATABASE_URL
  npx prisma db push --skip-generate
  npm run seed || echo "  (seed déjà appliqué — on continue)"
)

# ---- 7. Build + déploiement du frontend sur Static Web Apps -----------------
step "7/9 Build frontend (VITE_API_BASE_URL=${API_URL}/api/v1) + SWA"
az staticwebapp show -n "$SWA_NAME" -g "$RG" -o none 2>/dev/null || \
  az staticwebapp create -n "$SWA_NAME" -g "$RG" -l "$SWA_LOCATION" --sku Free -o none
SWA_TOKEN="$(az staticwebapp secrets list -n "$SWA_NAME" -g "$RG" --query properties.apiKey -o tsv)"
SWA_HOST="$(az staticwebapp show -n "$SWA_NAME" -g "$RG" --query defaultHostname -o tsv)"
SWA_URL="https://${SWA_HOST}"
(
  cd "${REPO_ROOT}/frontend"
  VITE_API_BASE_URL="${API_URL}/api/v1" npm run build
  npx --yes @azure/static-web-apps-cli deploy ./dist \
    --deployment-token "$SWA_TOKEN" --env production
)

# ---- 8. CORS : backend n'accepte que l'origine du SWA -----------------------
step "8/9 Mise à jour du CORS_ORIGIN backend -> ${SWA_URL}"
az containerapp update -n "$API_APP" -g "$RG" \
  --set-env-vars CORS_ORIGIN="$SWA_URL" -o none

# ---- 9. Récapitulatif -------------------------------------------------------
step "9/9 Terminé ✅"
cat <<EOF

  Frontend (SPA)  : ${SWA_URL}
  Backend  (API)  : ${API_URL}/health
  Postgres        : ${PG_HOST}
  Redis           : ${REDIS_FQDN}:6379 (interne à l'env Container Apps)

  Comptes démo    : buyer@trustpass.dev / password123 (+ seller / organizer / controller)
  Secrets locaux  : ${STATE_FILE}  (ne pas committer)

  Démonter tout   : az group delete -n ${RG} --yes --no-wait
EOF
