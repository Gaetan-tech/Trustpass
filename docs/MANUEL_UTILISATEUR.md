# Manuel utilisateur — TrustPass (C2.4.1)

> Guide d'utilisation destiné aux **utilisateurs finaux** de la plateforme de revente
> sécurisée de billets. Pour l'installation/déploiement, voir `docs/DEPLOYMENT.md`.
> Pour la maintenance et les mises à jour, voir `docs/MANUEL_MISE_A_JOUR.md`.

## 1. Présentation

TrustPass permet de **revendre et d'acheter des billets d'événements** en toute sécurité :
prix **plafonné** par l'organisateur, **transfert de propriété** avec régénération du QR
(l'ancien billet devient invalide), traçabilité complète. Fini les faux billets et les doublons.

## 2. Rôles et accès

| Rôle | Comptes de démonstration | Peut faire |
|------|--------------------------|------------|
| Acheteur | `buyer@trustpass.dev` | Acheter, gérer et transférer ses billets |
| Vendeur | `seller@trustpass.dev` | Mettre un billet en revente |
| Organisateur | `organizer@trustpass.dev` | Gérer événements et règles de revente |
| Contrôleur | `controller@trustpass.dev` | Scanner les billets à l'entrée |

_Mot de passe de démonstration : `password123`._ Se connecter via **« Connexion »** (menu haut-droit).

## 3. Acheter un billet

1. Sur la **Marketplace** (page d'accueil), parcourez les billets en revente (chaque carte affiche
   l'événement, la date, le lieu, la catégorie et le prix).
2. Cliquez sur **« Acheter »**. Si vous n'êtes pas connecté, vous serez invité à vous connecter.
3. Dans le tunnel d'achat, vérifiez l'événement et le prix, puis cliquez **« Payer »**.
4. Confirmez le paiement (**paiement simulé** dans cette version — aucun débit réel).
5. À la confirmation, le billet est **transféré** : un **nouveau QR** est généré et le billet
   apparaît dans **« Mes billets »**.

## 4. Consulter et transférer « Mes billets »

- **Mes billets** liste vos billets avec leur statut (`OWNED`, `USED`…), la référence et le porteur.
- **Aperçu** : affiche le visuel du billet (photo de l'événement, QR) et permet de le
  **télécharger en PNG**.
- **Transférer à un proche** : renseignez le **nom** et l'**email** du destinataire.
  - S'il a déjà un compte, le billet apparaît directement dans son espace.
  - Sinon, le billet lui est réservé (nominatif) : il le récupère en créant un compte avec cet email.
  - Un **nouveau QR** et une **nouvelle référence** sont générés (l'ancien billet est invalidé).
  - Un billet **déjà passé au contrôle** ou **en vente** ne peut pas être transféré.

## 5. Mettre un billet en revente (vendeur)

1. Menu **« Vendre »**.
2. **Étape 1 — Rattacher** un billet possédé (référence du billet).
3. **Étape 2 — Publier** l'annonce en fixant un prix **≤ plafond** et **dans la fenêtre de revente**.
4. Vous pouvez **retirer** une annonce tant qu'elle n'est pas vendue.

## 6. Gérer un événement (organisateur)

Menu **« Organisateur »** :
- **Créer / modifier / supprimer** un événement (nom, lieu, date, catégories/tarifs).
- **Fixer le plafond de revente** (ex. 120 €) et la **date de clôture** de la revente.
- **Consulter l'historique** d'un billet (traçabilité des transferts).

## 7. Contrôler l'accès (contrôleur)

Menu **« Contrôle »** :
1. Saisissez/scannez le **code QR** du billet.
2. L'écran affiche la **validité**, le **propriétaire** et l'**historique**.
3. Un billet déjà scanné ou invalidé est signalé comme non valide.

## 8. Générer une maquette de billet

Menu **« Maquette »** : choisissez un événement, renseignez porteur/catégorie/référence,
puis **téléchargez le visuel en PNG** (photo de l'événement en fond, QR de démonstration
non scannable).

## 9. Accessibilité & confort

- Navigation **au clavier** possible sur tous les parcours (focus visible).
- Les **animations décoratives** se désactivent automatiquement si votre système est réglé sur
  « réduire les animations » (`prefers-reduced-motion`).
- Voir `docs/ACCESSIBILITE.md` pour le détail.

## 10. Problèmes fréquents

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| « Ce billet vient d'être réservé » | Un autre acheteur a réservé en premier | Réessayer plus tard ou choisir une autre annonce |
| « La fenêtre de revente est fermée » | Revente clôturée pour l'événement | Achat impossible via revente |
| Transfert refusé | Billet déjà scanné ou en vente | Retirer de la vente ; un billet utilisé n'est plus transférable |
| Rien ne s'affiche sur la marketplace | Backend non démarré / stack down | Voir `docs/DEPLOYMENT.md` (démarrage de la stack) |
