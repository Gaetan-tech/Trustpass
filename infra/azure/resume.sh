#!/usr/bin/env bash
# RÉVEILLE TrustPass après pause.sh :
#   - Démarre le serveur PostgreSQL
#   - Remet backend + Redis (Container Apps) à 1 réplica minimum
# Usage : bash infra/azure/resume.sh
set -euo pipefail
RG="${RG:-trustpass-rg}"
API_APP="${API_APP:-trustpass-api}"
SUFFIX="${SUFFIX:-1d390e}"
REDIS_NAME="${REDIS_NAME:-trustpass-redis-${SUFFIX}}"
PG_SERVER="${PG_SERVER:-trustpass-pg-${SUFFIX}}"

echo "▶ Démarrage PostgreSQL $PG_SERVER (peut prendre 1-2 min)"
az postgres flexible-server start -n "$PG_SERVER" -g "$RG" -o none
echo "▶ Redis $REDIS_NAME -> 1 réplica"
az containerapp update -n "$REDIS_NAME" -g "$RG" --min-replicas 1 --max-replicas 1 -o none
echo "▶ Backend $API_APP -> 1 réplica (workers in-process)"
az containerapp update -n "$API_APP" -g "$RG" --min-replicas 1 --max-replicas 3 -o none

echo "✅ En ligne. Frontend : https://wonderful-water-06fe97f0f.7.azurestaticapps.net"
