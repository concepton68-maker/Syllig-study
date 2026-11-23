# Syllig Study — règles du projet

## Règles demandées par le propriétaire (à respecter à chaque modification)
- **Fonctions groupées partout** : toute liste qu'on gère (cours, copies, demandes, brouillons, comptes…) doit permettre
  de cocher plusieurs lignes et d'appliquer une action groupée. Utiliser `src/components/Bulk.tsx`
  (`<BulkBar formId=… actions=…>` + `<BulkCheck formId=… value=…>` sur chaque ligne ; l'action serveur lit `form.getAll('ids')`).
- **Écran fixe** : la page ne défile jamais en entier ; seules les zones de contenu défilent (`Screen`, `Panes`, `Pane`).
- **Couleurs et thèmes** : thèmes par élève (`[data-theme]`) ; Léa utilise « Girly ✦ Ice blue » (glacier).
- **Pas d'IA branchée dans la plateforme** : cours et corrections passent par export / import avec Claude, validés par le parent.
- **Versions** : fichier `VERSION` (0.01, 0.02…), à incrémenter à chaque mise en ligne, avec une entrée dans `CHANGELOG.md`.
  Le numéro s'affiche en haut de chaque écran et sur la page de connexion.
- **Pas de commande à faire taper** au propriétaire pour mettre à jour : pousser sur `main` déploie seul (cron sur le VPS,
  `deploy/auto-update.sh`). Donc ne pousser sur `main` que du code testé (build + `tests/e2e-*.mjs`).

## Repères techniques
- Next.js 15 (App Router, actions serveur), PostgreSQL 16 (postgres.js), Tailwind v4, Docker Compose derrière Caddy.
- Migrations SQL dans `db/migrations` (numérotées, appliquées une fois) ; journal d'activité en lecture seule et chaîné.
- Tests : `tests/reset-db.sh` puis `BASE=… node tests/e2e-parcours.mjs` et `tests/e2e-reinitialisation.mjs`.
