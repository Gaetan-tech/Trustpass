# Runbook — Commandes payées non transférées (alerte P1)

> Procédure de reprise associée à l'alerte `PaiementsNonTransferes`
> (`trustpass_orders_paid_not_transferred > 3` pendant 2 min). Origine :
> anomalie AN-2026-017. Objectif : rétablir le service (atténuation) puis
> confirmer la cause avant clôture. (BLOC 4, §3.2.7, §4.2)

## Symptôme
Après un paiement accepté par Stripe, la commande reste au statut `paid` et le
billet n'apparaît pas dans « Mes billets » ; `POST /api/v1/webhooks/stripe`
renvoie des HTTP 500 en rafale et Stripe rejoue les notifications.

## 1. Premières vérifications (≤ 5 min)
1. Tableau de bord Grafana « Tunnel d'achat » → taux de réussite et délai
   paiement → transfert.
2. Tableau de bord « Files et workers » → profondeur et âge de la file de transfert.
3. Journaux API (filtrer par `requestId`) : rechercher l'erreur Prisma **P2024**
   (délai dépassé à l'acquisition d'une connexion → saturation du pool).
4. Contrôle base — commandes orphelines :
   ```sql
   SELECT id, created_at FROM "Order"
   WHERE status = 'paid'
     AND id NOT IN (SELECT order_id FROM "Transfer")
   ORDER BY created_at DESC;
   ```

## 2. Atténuation immédiate (rendre le service)
- **Augmenter la capacité** : passer temporairement l'API de 2 à 4 réplicas
  (multiplie les connexions disponibles).
  ```bash
  kubectl -n prod scale deploy/backend --replicas=4
  ```
- **Rejouer les webhooks en échec** depuis le tableau de bord Stripe : sans
  risque, le traitement est **idempotent** par identifiant d'événement.

## 3. Cause racine probable
Couplage d'un traitement long (transfert + envoi de courriel) à la réponse HTTP,
sur un pool de connexions Prisma sous-dimensionné pour le pic.

## 4. Correction durable
- Webhook **asynchrone** : accuser réception après vérification de signature +
  enregistrement idempotent, puis déléguer le transfert à un worker BullMQ.
- Porter `DATABASE_CONNECTION_LIMIT` à ≥ 20 (configurable).
- Vérifier la présence des alertes précurseurs (saturation pool P3, orphelines P1).

## 5. Critère de clôture
Aucune commande orpheline sur 48 h, `p95` du webhook < 1 s, taux de réussite du
tunnel ≥ 99 % sur un pic comparable.

## Retour arrière
`kubectl -n prod rollout undo deploy/backend` (< 2 min) — aucune migration à
défaire si le correctif ne touche pas le schéma.
