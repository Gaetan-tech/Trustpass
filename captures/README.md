# Captures — Figures du dossier (preuves)

Captures d'écran de l'application **en fonctionnement**, générées **depuis ce dépôt**
(code local, données du script de seed), via Playwright. Elles correspondent aux
figures 1 à 4 du dossier de certification.

| Fichier | Figure | Contenu |
|---------|--------|---------|
| `fig1-marketplace.png` | Fig. 1 | Marketplace : hero, blocs de réassurance, cartes d'annonce |
| `fig2-vendre.png` | Fig. 2 | Espace vendeur : rattacher un billet → publier l'annonce |
| `fig3-dashboard-organisateur.png` | Fig. 3 | Dashboard : plafond de revente, KPIs, historique de possession |
| `fig4-maquette.png` | Fig. 4 | Générateur de maquette de billet + aperçu + export PNG |

## Régénérer les figures

Prérequis : stack lancée et base seedée (voir `README.md` à la racine), puis :

```bash
cd frontend
node scripts/capture-figures.mjs   # écrit les PNG dans ../captures/
```

Le script (`frontend/scripts/capture-figures.mjs`) pilote un navigateur headless,
se connecte avec le compte de démonstration `organizer@trustpass.dev`, visite les
quatre pages et enregistre chaque capture.
