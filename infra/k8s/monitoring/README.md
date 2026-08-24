# Supervision — TrustPass (BLOC 4, annexe B)

Configuration de supervision versionnée avec l'infrastructure.

| Fichier | Rôle | Section du dossier |
|---------|------|--------------------|
| `alert-rules.yaml` | Règles d'alerte Prometheus (métier + technique + sécurité), avec sévérité et renvoi runbook | §3.2.5 |
| `alertmanager-config.yaml` | Routage par sévérité, escalade, regroupement, silences | §3.2.6 |
| `grafana-dashboards.yaml` | 4 tableaux de bord (Santé plateforme, Tunnel d'achat, Files et workers, Dépendances tierces) | §3.2.7 |

Les métriques `trustpass_*` référencées ici sont exposées par l'API au format
Prometheus (`GET /metrics`, via `prom-client`) — voir `backend/src/lib/metrics.ts`
et `backend/src/modules/health/`. Les procédures de reprise citées par les
annotations `runbook` vivent dans `docs/runbooks/`.

> Cible : Azure Monitor managed Prometheus + Grafana (Application Insights pour
> les traces). Les CRD `PrometheusRule` / `Alertmanager` supposent l'opérateur
> Prometheus (ou l'équivalent managé) installé sur le cluster.
