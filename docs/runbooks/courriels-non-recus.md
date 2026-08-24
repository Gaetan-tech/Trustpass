# Runbook — Courriels de confirmation non reçus (alerte P2)

> Procédure de reprise associée aux alertes `FileCourrielsEnRetard`
> (`trustpass_queue_oldest_job_seconds{queue="emails"} > 300`) et taux d'échec
> d'envoi > 1 %. Origine : anomalie AN-2026-021. Remise au support de niveau 1
> pour résolution sans escalade. (BLOC 4, §3.2.7, §5.3)

## Symptôme
Des acheteurs signalent « j'ai payé mais je n'ai pas reçu mon billet par
courriel ». **Important** : le billet est en général **bien livré** (présent
dans « Mes billets », QR valide) — c'est le courriel qui manque.

## 1. Réponse de niveau 1 (support, sans escalade)
1. Vérifier dans « Mes billets » du compte concerné : si le billet est présent
   avec un QR valide, **rassurer l'acheteur** : le billet est déjà utilisable, le
   courriel suit.
2. Réponse type : « Votre billet est déjà disponible dans *Mes billets* et
   scannable à l'entrée ; l'email de confirmation arrive dans quelques minutes. »

## 2. Vérifications techniques (niveau 2)
1. Tableau de bord « Files et workers » → âge et profondeur de la file `emails`.
2. Journaux du worker d'envoi : rechercher les réponses **HTTP 429** du
   prestataire (quota dépassé).
3. Confirmer que les tâches sont **persistées** (Redis) — donc aucun courriel perdu.

## 3. Atténuation immédiate
- Relever temporairement le quota auprès du prestataire d'envoi (Resend), puis
  laisser la file se vider (rejeu automatique BullMQ).

## 4. Correction durable (livrée en v1.4.2)
- Limiteur de débit sur le worker à **80 envois/min** (sous le quota négocié),
  avec reprise **exponentielle** (évite que toutes les tentatives repartent
  ensemble).
- Alertes P2 sur l'âge de la file (> 300 s) et le taux d'échec d'envoi (> 1 %).
- Message d'interface après achat rappelant que le billet est déjà disponible.

## 5. Critère de clôture
Âge de file < 60 s en régime de pic, taux d'échec d'envoi < 1 %, sollicitations
support sur ce motif en forte baisse sur la campagne suivante.
