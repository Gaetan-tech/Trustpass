#!/usr/bin/env bash
# RÉVEILLE TrustPass après pause.sh :
#   - Démarre le serveur PostgreSQL
#   - Remet le backend (Container App) à 1 réplica — le sidecar Redis redémarre
#     avec lui
# Usage : bash infra/azure/resume.sh
set -euo pipefail
RG="${RG:-trustpass-rg}"
API_APP="${API_APP:-trustpass-api}"
SUFFIX="${SUFFIX:-1d390e}"
PG_SERVER="${PG_SERVER:-trustpass-pg-${SUFFIX}}"

echo "▶ Démarrage PostgreSQL $PG_SERVER (peut prendre 1-2 min)"
az postgres flexible-server start -n "$PG_SERVER" -g "$RG" -o none
echo "▶ Backend $API_APP -> 1 réplica (workers in-process + Redis sidecar)"
az containerapp update -n "$API_APP" -g "$RG" --min-replicas 1 --max-replicas 3 -o none

echo "✅ En ligne. Frontend : https://wonderful-water-06fe97f0f.7.azurestaticapps.net"
