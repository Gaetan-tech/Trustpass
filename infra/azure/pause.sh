#!/usr/bin/env bash
# Met TrustPass en VEILLE pour réduire les coûts (données conservées).
#   - Arrête le serveur PostgreSQL (facturation compute stoppée)
#   - Scale le backend (Container App) à 0 réplica — le sidecar Redis s'arrête
#     avec lui (même conteneur d'application)
# Le frontend (Static Web Apps, gratuit) reste en ligne ; les appels API
# échoueront jusqu'au `resume.sh`.
# Usage : bash infra/azure/pause.sh
set -euo pipefail
RG="${RG:-trustpass-rg}"
API_APP="${API_APP:-trustpass-api}"
SUFFIX="${SUFFIX:-1d390e}"
PG_SERVER="${PG_SERVER:-trustpass-pg-${SUFFIX}}"

echo "▶ Scale backend $API_APP -> 0 réplica (Redis sidecar inclus)"
az containerapp update -n "$API_APP" -g "$RG" --min-replicas 0 --max-replicas 3 -o none
echo "▶ Arrêt PostgreSQL $PG_SERVER"
az postgres flexible-server stop -n "$PG_SERVER" -g "$RG" -o none

echo "✅ En veille. Coût résiduel ≈ stockage seul. Réveil : bash infra/azure/resume.sh"
