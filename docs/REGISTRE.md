# Registre des anomalies et limitations — TrustPass

Registre unique des anomalies rencontrées en exploitation (projet GitHub
« Maintenance »). Chaque entrée croise sévérité, domaine et statut, et renvoie à
l'issue / la Pull Request / la version qui la referme. (BLOC 4, §4.1.2, §4.2.6, §7)

## Anomalies traitées

| Réf. | Symptôme | Sév. | Cause racine | Traitement / version | Statut |
|------|----------|------|--------------|----------------------|--------|
| AN-001 | Annonce réservée jamais libérée après abandon de paiement | P2 | Expiration silencieuse du verrou Redis non propagée en base | Worker `reservationReaper` (bloc 2), couvert par `tunnel.test.ts` | Clôturée |
| AN-2026-017 | Commandes payées non transférées sous charge | P1 | Traitement synchrone du webhook saturant le pool de connexions | Traitement asynchrone — v1.4.1 (issue #147, PR #148) | Clôturée |
| AN-2026-019 | Mémoire du worker croissant de 4 %/heure | P3 | Écouteurs d'événements BullMQ non détachés en fin de tâche | Détachement explicite + alerte mémoire — v1.4.2 | Clôturée |
| AN-2026-021 | Courriels de confirmation non reçus en pic | P2 | Quota du prestataire d'envoi dépassé (HTTP 429), sans lissage | Limiteur de débit, reprise et alerte — v1.4.2 | Clôturée |
| AN-2026-023 | Statut « Disponible » affiché sur une annonce vendue | P4 | Cache client non invalidé après achat concurrent | Invalidation ciblée React Query — v1.5.0 | Clôturée |
| AN-2026-025 | Le script de peuplement échoue si les comptes existent | P4 | Création non idempotente (`create` au lieu de `upsert`) | Peuplement idempotent — v1.5.0 (R8) | Clôturée |

## Limitations assumées / anomalies ouvertes (BLOC 4, §6)

| Réf. | Limitation | Perspective |
|------|------------|-------------|
| L1 | Supervision non validée par injection de pannes (chaos) | Campagne de chaos engineering planifiée |
| L2 | Astreinte à une seule personne (projet mono-développeur) | Disparaît à l'industrialisation chez Tick&Live |
| L3 | Historique court (2 mois) → seuils fixes à réviser | R7 — seuils dynamiques après historique suffisant |
| L4 | `npm audit` non bloquant, sauvegarde DB manuelle, RGAA à déclarer | R3, R5, R6 |
| L5 | Erreurs JavaScript côté navigateur non centralisées | Ajout d'un collecteur d'erreurs front |

## Axes de classement des issues
- **Sévérité** : P1 · P2 · P3 · P4
- **Domaine** : paiement · billetterie · authentification · infra
- **Statut** : à qualifier · en cours · en vérification · clôturée
