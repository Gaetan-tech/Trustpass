# Journal des versions — TrustPass

Format : une entrée par version publiée, classification constante (Nouvelles
fonctionnalités, Améliorations, Corrections de bogues, Sécurité, Dépendances,
Ruptures), renvoi systématique vers l'issue et la Pull Request d'origine.
Numérotation [SemVer](https://semver.org/lang/fr/) : majeur = rupture, mineur =
ajout compatible, correctif = correction. Chaque étiquette est également publiée
comme note de version GitHub. (BLOC 4, §5.2)

## [1.5.0] — 12/08/2026
### Nouvelles fonctionnalités
- Mise en cache de la marketplace (Redis, TTL 30 s) avec invalidation à chaque mutation (#161)
- Export CSV de l'historique de possession depuis le tableau de bord organisateur (#158)
### Améliorations
- Index composite (event, status, createdAt) et pagination par curseur sur les annonces (#162)
  → temps de réponse de `GET /listings` : p95 410 ms → 118 ms sur le jeu de démonstration
- Script de peuplement rendu idempotent : upsert sur l'adresse de courriel (#160, clôt AN-2026-025)
### Corrections de bogues
- [AN-2026-023] Statut « Disponible » affiché sur une annonce déjà vendue : invalidation du cache client après achat concurrent (#159)
### Sécurité
- Analyse `npm audit` rendue bloquante dans la chaîne d'intégration (#163)

## [1.4.2] — 31/07/2026
### Corrections de bogues
- [AN-2026-021] Courriels de confirmation non reçus lors des pics : limiteur de débit sur le worker d'envoi (80/min), reprise exponentielle et rejeu automatique de la file (#154)
- [AN-2026-019] Croissance continue de la mémoire du worker : détachement explicite des écouteurs d'événements en fin de tâche (#152)
### Améliorations
- Nouvelles alertes : taux d'échec d'envoi > 1 % (P2) et âge de la file > 300 s (P2) (#155)
- Message d'interface après achat : « billet disponible immédiatement dans Mes billets, courriel de confirmation sous quelques minutes » (#156)
### Dépendances
- Montée de Playwright vers la version majeure suivante (4 spécifications adaptées) (#150)
- 11 correctifs de dépendances applicatives et de développement (lot Dependabot du 27/07)

## [1.4.1] — 10/07/2026 · correctif d'urgence
### Corrections de bogues
- [AN-2026-017] Commandes payées non transférées sous charge (#147) : le webhook Stripe accuse désormais réception immédiatement après vérification de signature et enregistrement idempotent, puis délègue le transfert à un worker BullMQ (#148)
  → traitement du webhook p95 : 9,4 s → 0,18 s ; commandes orphelines : 12 → 0
### Améliorations
- Limite du pool de connexions rendue configurable (`DATABASE_CONNECTION_LIMIT`, défaut 20)
- Alertes ajoutées : saturation du pool (P3), commandes payées non transférées (P1)
- Test d'intégration de charge : 40 webhooks concurrents (`webhook.concurrency.test.ts`)

## [1.4.0] — 05/06/2026
### Nouvelles fonctionnalités
- Supervision : sondes `/live`, `/ready`, `/health` et exposition `/metrics` (prom-client) (#131)
- Tableaux de bord Grafana (santé, tunnel d'achat, files, dépendances tierces) (#134)
- Règles d'alerte et routage Alertmanager vers Slack et l'astreinte (#136)
### Améliorations
- Journalisation structurée pino avec propagation du `requestId` de bout en bout (#132)
- Traçage OpenTelemetry des appels base, cache et sortants (#133)
