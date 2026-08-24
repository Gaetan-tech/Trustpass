#!/usr/bin/env bash
# =============================================================================
# TrustPass — Monitoring du déploiement Container Apps via Azure Monitor (gratuit)
#   - Application Insights (rattaché au Log Analytics de l'environnement ACA)
#   - Test de disponibilité (ping /health) + alerte de disponibilité
#   - Groupe d'action (notification email)
#   - Règles d'alerte sur les métriques du Container App backend
#     (5xx, redémarrages, latence, CPU, mémoire)
#
# Alternative "gratuite" à la stack Prometheus/Grafana des manifestes k8s
# (infra/k8s/monitoring/), qui suppose un cluster AKS. Idempotent, relançable.
# Prérequis : az connecté (az login), extension application-insights.
# Usage : bash infra/azure/monitoring.sh
# =============================================================================
set -euo pipefail
# Git Bash (MSYS) mangle les IDs ARM commençant par "/" — on désactive la conversion.
export MSYS_NO_PATHCONV=1

RG="${RG:-trustpass-rg}"
LOCATION="${LOCATION:-francecentral}"
API_APP="${API_APP:-trustpass-api}"
AI_NAME="${AI_NAME:-trustpass-ai}"
AG_NAME="${AG_NAME:-trustpass-oncall}"
WEBTEST="${WEBTEST:-trustpass-health-ping}"
# Email de notification (surcharge possible : EMAIL=... bash infra/azure/monitoring.sh)
EMAIL="${EMAIL:-fomatfomateaudreygaetan@gmail.com}"

step() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

az extension add --name application-insights --upgrade --only-show-errors 2>/dev/null || true
az provider register -n microsoft.insights --wait 2>/dev/null || true

# --- 0. Découverte des ressources -------------------------------------------
step "0 Découverte (Log Analytics, Container App)"
LA_ID="$(az monitor log-analytics workspace list -g "$RG" --query "[0].id" -o tsv)"
API_ID="$(az containerapp show -n "$API_APP" -g "$RG" --query id -o tsv)"
FQDN="$(az containerapp show -n "$API_APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
[ -n "$LA_ID" ] || { echo "Log Analytics introuvable dans $RG"; exit 1; }
echo "  LA=$LA_ID"
echo "  API=$API_ID"

# --- 1. Groupe d'action (email) ---------------------------------------------
step "1 Groupe d'action (email → $EMAIL)"
az monitor action-group create -n "$AG_NAME" -g "$RG" --short-name tpalerts \
  --action email admin "$EMAIL" -o none
AG_ID="$(az monitor action-group show -n "$AG_NAME" -g "$RG" --query id -o tsv)"

# --- 2. Application Insights (workspace-based) ------------------------------
step "2 Application Insights (rattaché au Log Analytics)"
az monitor app-insights component show --app "$AI_NAME" -g "$RG" -o none 2>/dev/null || \
  az monitor app-insights component create --app "$AI_NAME" -g "$RG" -l "$LOCATION" \
    --workspace "$LA_ID" --application-type web --kind web -o none
AI_ID="$(az monitor app-insights component show --app "$AI_NAME" -g "$RG" --query id -o tsv)"

# --- 3. Test de disponibilité (ping /health) --------------------------------
step "3 Test de disponibilité → https://$FQDN/health"
az monitor app-insights web-test show --name "$WEBTEST" -g "$RG" -o none 2>/dev/null || \
  az monitor app-insights web-test create \
    --name "$WEBTEST" -g "$RG" --location "$LOCATION" \
    --web-test-kind standard --enabled true --frequency 300 --timeout 30 --retry-enabled true \
    --defined-web-test-name "$WEBTEST" \
    --tags "hidden-link:$AI_ID=Resource" \
    --locations Id=emea-nl-ams-azr Id=us-il-ch1-azr \
    --request-url "https://$FQDN/health" --http-verb GET --ssl-check false -o none

# --- 4. Règles d'alerte ------------------------------------------------------
step "4 Règles d'alerte (métriques Container App + disponibilité)"
mk() { # nom sévérité fenêtre scope "condition" "description"
  az monitor metrics alert show -n "$1" -g "$RG" -o none 2>/dev/null && { echo "  = $1 (existe)"; return; }
  az monitor metrics alert create -n "$1" -g "$RG" --scopes "$4" \
    --severity "$2" --window-size "$3" --evaluation-frequency 1m \
    --condition "$5" --description "$6" --action "$AG_ID" -o none
  echo "  + $1"
}
mk trustpass-disponibilite 1 5m  "$AI_ID"  "avg availabilityResults/availabilityPercentage < 90" "Disponibilité perçue < 90% (sonde /health)"
mk trustpass-5xx           1 5m  "$API_ID" "total Requests > 10 where statusCodeCategory includes 5xx" "Taux d'erreurs 5xx élevé (backend)"
mk trustpass-restarts      2 5m  "$API_ID" "total RestartCount > 3" "Redémarrages répétés du conteneur backend"
mk trustpass-latency       2 10m "$API_ID" "avg ResponseTime > 2000" "Latence backend moyenne > 2 s"
mk trustpass-cpu           3 15m "$API_ID" "avg CpuPercentage > 80" "CPU backend > 80% (anticipation capacité)"
mk trustpass-mem           3 15m "$API_ID" "avg MemoryPercentage > 80" "Mémoire backend > 80%"

# --- 5. Récapitulatif --------------------------------------------------------
step "5 Terminé ✅"
az monitor metrics alert list -g "$RG" --query "[].{alerte:name,sev:severity,active:enabled}" -o table
cat <<EOF

  Application Insights : $AI_NAME
  Test disponibilité   : $WEBTEST  → https://$FQDN/health
  Notifications        : $EMAIL (groupe d'action $AG_NAME)
  Logs                 : Log Analytics de l'environnement Container Apps (KQL)

  NB : les métriques MÉTIER trustpass_* (/metrics) nécessitent l'instrumentation
       OpenTelemetry → App Insights pour être collectées sur Container Apps.
EOF
