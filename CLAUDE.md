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
- Tests : `tests/reset-db.sh` puis `BASE=… node tests/e2e-parcours.mjs` et aussitôt `e2e-reinitialisation.mjs` ; à nouveau `tests/reset-db.sh`, `e2e-parcours.mjs`, puis `e2e-actions-groupees.mjs` (a besoin du cours créé par le parcours), `e2e-dossier.mjs` ; après `tests/reset-db.sh` seul : `e2e-mot-de-passe.mjs` ; après `node scripts/seed.mjs` : `e2e-eleve-scenarios.mjs`, `e2e-sauvegarde.mjs` ; pour les cours : `node scripts/seed.mjs` puis `COURS=TG001,TG034 node tests/e2e-cours-complet.mjs` (parcours complet, 20/20 attendu).
- Confirmations : jamais `window.confirm` côté élève (Firefox peut bloquer les fenêtres) ; `ConfirmButton` affiche la confirmation dans la page (« Oui, confirmer »).
- Niveaux : un dossier `content/<niveau>/programme.json` par niveau (chargé au démarrage) ; `content/<niveau>/cours/*.json` = cours prêts, publiés automatiquement s’ils n’ont encore aucune version.
- Dossier scolaire : table `student_years` (une année par ligne) ; `src/lib/school-years.ts`.
