#!/usr/bin/env bash
# Met TrustPass en VEILLE pour réduire les coûts (données conservées).
#   - Arrête le serveur PostgreSQL (facturation compute stoppée)
#   - Scale backend + Redis (Container Apps) à 0 réplica
# Le frontend (Static Web Apps, gratuit) reste en ligne ; les appels API
# échoueront jusqu'au `resume.sh`.
# Usage : bash infra/azure/pause.sh
set -euo pipefail
RG="${RG:-trustpass-rg}"
API_APP="${API_APP:-trustpass-api}"
SUFFIX="${SUFFIX:-1d390e}"
REDIS_NAME="${REDIS_NAME:-trustpass-redis-${SUFFIX}}"
PG_SERVER="${PG_SERVER:-trustpass-pg-${SUFFIX}}"

echo "▶ Scale backend $API_APP -> 0 réplica"
az containerapp update -n "$API_APP" -g "$RG" --min-replicas 0 --max-replicas 3 -o none
echo "▶ Scale Redis $REDIS_NAME -> 0 réplica"
az containerapp update -n "$REDIS_NAME" -g "$RG" --min-replicas 0 --max-replicas 1 -o none
echo "▶ Arrêt PostgreSQL $PG_SERVER"
az postgres flexible-server stop -n "$PG_SERVER" -g "$RG" -o none

echo "✅ En veille. Coût résiduel ≈ stockage seul. Réveil : bash infra/azure/resume.sh"
