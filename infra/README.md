# Infrastructure & déploiement — TrustPass

Infra **cost-minimal** sur Azure : **1 cluster AKS** partagé + **1 ACR**, avec **3 environnements =
3 namespaces** (`staging`, `preprod`, `prod`). Postgres et Redis tournent **in-cluster** (démo).

```
infra/
├── terraform/        # Ressources Azure (Resource Group, ACR, AKS)
└── k8s/
    ├── base/         # Manifests communs (backend, frontend, postgres, redis, ingress)
    ├── overlays/     # staging / preprod / prod (namespace, CORS, host, réplicas)
    └── create-secrets.sh
```

> ⚠️ **Coût** : le plan de contrôle AKS est gratuit, **les nœuds sont facturés**. Sur un compte
> d'essai (200 $ / 30 j) c'est couvert. Pense à `terraform destroy` après la démo.

## 1. Prérequis
- `az` (connecté : `az login`), `terraform`, `kubectl`, `docker`.
- Souscription Azure active (`az account show`).

## 2. Provisionner les ressources (Terraform)

```bash
cd infra/terraform
terraform init
terraform plan        # revoir ce qui sera créé
terraform apply       # crée RG + ACR + AKS (~10 min)

# Récupérer les sorties
terraform output
az aks get-credentials -g $(terraform output -raw resource_group) -n $(terraform output -raw aks_name)
```

## 3. Contrôleur Ingress (une fois)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
# Récupérer l'IP publique de l'ingress :
kubectl -n ingress-nginx get svc ingress-nginx-controller
```
Mappe les hosts (`staging.trustpass.local`, …) vers cette IP via `/etc/hosts` ou remplace-les par
`staging.<IP>.nip.io` dans les overlays.

## 4. Déploiement manuel d'un environnement (secours)

```bash
# Secrets + namespace (valeurs générées si non fournies)
bash infra/k8s/create-secrets.sh staging

# Fixer les images (ACR + tag) puis appliquer
cd infra/k8s/overlays/staging
kustomize edit set image \
  trustpass-backend=$(terraform -chdir=../../terraform output -raw acr_login_server)/trustpass-backend:latest \
  trustpass-frontend=$(terraform -chdir=../../terraform output -raw acr_login_server)/trustpass-frontend:latest
kustomize build . | kubectl apply -f -
```

## 5. Déploiement continu (GitHub Actions)

Pipelines : `.github/workflows/cd.yml` (+ `deploy.yml` réutilisable).
- `push develop` → **staging** (auto)
- `push main` → **preprod** (auto) → **prod** (avec **approbation** GitHub Environment)

### 5.1 Connexion GitHub → Azure (OIDC, sans secret longue durée)
```bash
# App d'identité + rôle sur la souscription
az ad app create --display-name trustpass-gha
APP_ID=$(az ad app list --display-name trustpass-gha --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID"
SUB=$(az account show --query id -o tsv)
az role assignment create --assignee "$APP_ID" --role Contributor --scope /subscriptions/$SUB
# Autoriser le push d'images :
ACR_ID=$(az acr show -n <ACR_NAME> --query id -o tsv)
az role assignment create --assignee "$APP_ID" --role AcrPush --scope "$ACR_ID"

# Federated credentials (une par branche déployée)
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name":"gha-main","issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:Gaetan-tech/Trustpass:ref:refs/heads/main","audiences":["api://AzureADTokenExchange"]}'
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name":"gha-develop","issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:Gaetan-tech/Trustpass:ref:refs/heads/develop","audiences":["api://AzureADTokenExchange"]}'
# + une par environnement protégé (prod/preprod/staging) :
#   "subject":"repo:Gaetan-tech/Trustpass:environment:prod"
```

### 5.2 Variables & secrets GitHub à définir
**Variables** (repo, `Settings → Secrets and variables → Actions → Variables`) :
| Nom | Valeur |
|-----|--------|
| `ACR_NAME` | sortie `acr_name` de Terraform |
| `ACR_LOGIN_SERVER` | sortie `acr_login_server` |
| `AKS_RESOURCE_GROUP` | sortie `resource_group` |
| `AKS_NAME` | sortie `aks_name` |

**Secrets** (repo) : `AZURE_CLIENT_ID` (=APP_ID), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

**Secrets par environnement** (`Environments → staging|preprod|prod`) — stables par env :
`POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
Configurer sur l'environnement **prod** une **règle de protection = approbation manuelle**.

## 6. Vérifier / exploiter
```bash
kubectl -n staging get pods,svc,ingress
kubectl -n staging logs deploy/backend
```

## 7. Démonter (arrêter les coûts)
```bash
cd infra/terraform && terraform destroy
```
