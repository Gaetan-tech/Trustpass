# Accessibilité — Référentiel, mesures et audit (C2.2.3)

> Ce document **présente et justifie le référentiel d'accessibilité retenu** pour TrustPass,
> détaille les **mesures effectivement mises en œuvre** dans le code, et décrit le
> **dispositif d'audit** (automatisé + manuel).

## 1. Référentiel choisi et justification

**Référentiel principal : RGAA 4.1** (Référentiel Général d'Amélioration de l'Accessibilité).
**Référentiel complémentaire : OPQUAST** (bonnes pratiques qualité web) sur le volet UX/robustesse.

**Pourquoi RGAA 4.1 ?**
- C'est le **référentiel officiel français**, opposable, attendu dans un contexte de certification en France.
- Il est une **déclinaison de WCAG 2.1 niveau AA** : viser le RGAA revient à viser WCAG 2.1 AA, standard international reconnu.
- Il fournit une **grille de critères testables** (13 thématiques) qui structure l'audit.

**Niveau visé : WCAG 2.1 AA** (équivalent RGAA « conforme » sur le périmètre implémenté).

OPQUAST est utilisé en complément pour les règles de qualité qui débordent l'accessibilité stricte
(feedback, cohérence, formulaires), déjà largement couvertes par le produit.

## 2. Mesures mises en œuvre (mappées RGAA / WCAG)

| Thème RGAA | Mesure dans TrustPass | Où |
|------------|-----------------------|-----|
| **8 – Éléments obligatoires** | Langue de la page déclarée `lang="fr"` ; titre de page explicite | `frontend/index.html` |
| **1 – Images** | Images **décoratives** (fonds photo d'événement) avec `alt=""` (non annoncées) ; l'information est portée par le texte adjacent | `Poster.tsx`, `ListingCard.tsx`, `MyTicketsPage.tsx`, `CheckoutModal.tsx` |
| **3 – Couleurs / contraste** | Texte encre `#0a0a0a` sur blanc ≈ **20:1** (AAA) ; accent violet `#7c3aed` sur blanc ≈ **5.7:1** (AA) ; statut jamais porté par la couleur seule (point coloré **+ libellé** : « Disponible », « En direct ») | `tailwind.config.js`, `index.css`, badges |
| **7 – Scripts / composants** | Rôles ARIA appropriés : `role="dialog"` + `aria-modal` sur les modales, `role="alert"` (erreurs), `role="status"` (confirmations), `role="note"` | modales, formulaires |
| **11 – Formulaires** | `<label>` associés à chaque champ ; messages d'erreur reliés au champ ; focus visible | `LoginPage`, `RegisterPage`, `SellPage`, formulaires de transfert |
| **10 – Présentation** | Focus clavier visible (anneau `focus:ring`), zones tactiles ≥ 44px sur les CTA | `index.css` (`.btn-neon`, `.input-dark`) |
| **12 – Navigation** | Navigation cohérente, liens de retour, structure de titres `h1/h2/h3` | `App.tsx`, pages |
| **13 – Consultation / mouvement** | **Respect de `prefers-reduced-motion`** : toutes les animations décoratives sont neutralisées si l'utilisateur le demande | `index.css` (media query) |

### Points d'attention documentés (choix assumés)
- **`autofocus`** sur l'écran de contrôle d'accès (`ScanPage`) : dérogation **volontaire et justifiée**
  (scan en rafale, écran mono-tâche). Signalée par un commentaire + `eslint-disable` ciblé.
- **Duotone / niveaux de gris** des visuels : purement décoratif, sans perte d'information.

## 3. Dispositif d'audit

### 3.1 Audit automatisé (dans la CI)
- **`eslint-plugin-jsx-a11y`** (règles *recommended*) intégré à `npm run lint` côté front :
  détecte à chaque commit/PR les erreurs d'accessibilité au niveau du JSX
  (alt redondants, labels manquants, rôles invalides, `autofocus`, etc.).
  → Exécuté par le job **frontend** de `.github/workflows/ci.yml`.
- **Lighthouse CI** (`frontend/lighthouserc.json`) : audit de la catégorie *accessibility*
  sur le build de production, seuil d'alerte **≥ 0,90**.
  → Job **lighthouse** de la CI (informatif).

### 3.2 Audit manuel (grille RGAA)
Vérifications réalisées manuellement, à rejouer avant livraison :
1. **Navigation clavier** seule (Tab / Shift+Tab / Entrée / Échap) sur les parcours clés
   (achat, transfert, connexion) — focus visible et ordre logique.
2. **Contrastes** vérifiés au ratio (encre/blanc, violet/blanc, texte sur photo via voile encre).
3. **Zoom 200 %** sans perte de contenu ni scroll horizontal (unités relatives, layout flex/grid).
4. **`prefers-reduced-motion`** activé : contrôle que les animations sont coupées.

## 4. Limites connues et suite
- Audit lecteur d'écran (NVDA/VoiceOver) à formaliser sur l'ensemble des parcours.
- Déclaration de conformité RGAA complète (grille des 106 critères) à produire pour une mise en
  production publique. Le présent périmètre couvre les critères applicables au prototype.

_Voir aussi : `docs/SECURITY.md` (volet OWASP de la compétence C2.2.3)._
