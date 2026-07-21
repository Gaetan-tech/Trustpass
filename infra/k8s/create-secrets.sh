#!/usr/bin/env bash
# Crée/actualise le namespace + le Secret `trustpass-secrets` d'un environnement.
# Valeurs prises dans les variables d'env si fournies (CI), sinon générées.
# Usage : ./create-secrets.sh <staging|preprod|prod>
set -euo pipefail

NS="${1:?namespace requis : staging | preprod | prod}"

PG_PWD="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"
JWT="${JWT_SECRET:-$(openssl rand -hex 24)}"
JWT_R="${JWT_REFRESH_SECRET:-$(openssl rand -hex 24)}"
DB_URL="postgresql://postgres:${PG_PWD}@postgres:5432/trustpass?schema=public"

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NS" create secret generic trustpass-secrets \
  --from-literal=POSTGRES_PASSWORD="$PG_PWD" \
  --from-literal=DATABASE_URL="$DB_URL" \
  --from-literal=JWT_SECRET="$JWT" \
  --from-literal=JWT_REFRESH_SECRET="$JWT_R" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "OK : namespace '$NS' + secret 'trustpass-secrets' appliqués."
