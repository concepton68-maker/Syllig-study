# Syllig Study — règles du projet

## Règles demandées par le propriétaire (à respecter à chaque modification)
- **Fonctions groupées partout** : toute liste qu'on gère (cours, copies, demandes, brouillons, comptes…) doit permettre
  de cocher plusieurs lignes et d'appliquer une action groupée. Utiliser `src/components/Bulk.tsx`
  (`<BulkBar formId=… actions=…>` + `<BulkCheck formId=… value=…>` sur chaque ligne ; l'action serveur lit `form.getAll('ids')`).
- **Écran fixe** : la page ne défile jamais en entier ; seules les zones de contenu défilent (`Screen`, `Panes`, `Pane`).
- **Couleurs et thèmes** : thèmes par élève (`[data-theme]`) ; Léa utilise « Girly ✦ Ice blue » (glacier).
- **IA branchée** (décision du propriétaire, 24/11/2026) : clés Mistral / Claude / Gemini dans Contenu › IA (chiffrées, `src/lib/ai.ts`), fournisseurs ajoutables (liste `src/lib/ai-presets.ts`, API compatibles OpenAI), fonctions attribuées sur chaque fournisseur — liste centrale extensible `TASKS` (`src/lib/ai.ts`). **RGPD** : données d'élèves uniquement chez un fournisseur UE (Mistral) sauf dérogation explicite, consentement du parent par enfant (`settings.ai_correction` / `ai_bilan`), réponses nettoyées (`src/lib/redact.ts`), chaque envoi consigné (`ai_requests`), purge après la durée de conservation, page publique `/confidentialite` ; l'IA ne fait que **proposer** points et commentaires, le parent valide toujours la note. L'export / import manuel reste possible. **Cours** : rédaction par l'IA possible (tâche « cours », aucune donnée d'élève), relecture et correction d'un cours existant (tâche « relecture », `src/lib/course-review.ts`), toujours en brouillon « À relire » avant publication. **Automatismes** (`src/lib/automation.ts`, file `jobs` traitée dans le serveur via `src/instrumentation.ts`) : correction dès la remise, bilan régulier, test proposé, leçons de rattrapage rédigées ; réglages par enfant (parent) et `auto_cours` (admin).
- **Versions** : fichier `VERSION` (0.01, 0.02…), à incrémenter à chaque mise en ligne, avec une entrée dans `CHANGELOG.md`.
  Le numéro s'affiche en haut de chaque écran et sur la page de connexion.
- **Pas de commande à faire taper** au propriétaire pour mettre à jour : pousser sur `main` déploie seul (cron sur le VPS,
  `deploy/auto-update.sh`). Donc ne pousser sur `main` que du code testé (build + `tests/e2e-*.mjs`).

## Repères techniques
- Next.js 15 (App Router, actions serveur), PostgreSQL 16 (postgres.js), Tailwind v4, Docker Compose derrière Caddy.
- Migrations SQL dans `db/migrations` (numérotées, appliquées une fois) ; journal d'activité en lecture seule et chaîné.
- Tests : `tests/reset-db.sh` puis `BASE=… node tests/e2e-parcours.mjs` et aussitôt `e2e-reinitialisation.mjs` ; à nouveau `tests/reset-db.sh`, `e2e-parcours.mjs`, puis `e2e-actions-groupees.mjs` (a besoin du cours créé par le parcours), `e2e-dossier.mjs` ; après `tests/reset-db.sh` seul : `e2e-mot-de-passe.mjs` ; après `node scripts/seed.mjs`, serveur lancé avec `AI_GEMINI_BASE_URL=http://127.0.0.1:3999 AI_ANTHROPIC_BASE_URL=http://127.0.0.1:3999 AI_MISTRAL_BASE_URL=http://127.0.0.1:3999` : `e2e-ia-correction.mjs`, `e2e-bilan.mjs` et `e2e-automatismes.mjs` (faux fournisseurs, aucune vraie clé ; reset + seed avant chacun ; serveur avec `JOBS_TICK_MS=1000`) ; après `node scripts/seed.mjs` : `e2e-cours-manuel.mjs` (cours par export / import Claude), `e2e-eleve-scenarios.mjs`, `e2e-sauvegarde.mjs` ; pour les cours : `node scripts/seed.mjs` puis `COURS=TG001,TG034 node tests/e2e-cours-complet.mjs` (parcours complet, 20/20 attendu).
- Confirmations : jamais `window.confirm`, `alert` ni bulles `title` du navigateur. Utiliser `askConfirm` / `confirmSubmit` de `src/components/Dialog.tsx` (fenêtre de l'application, bouton `[data-dialog-ok]` dans les tests), `ConfirmButton`, `data-tip` pour les infobulles ; les bulles de champs sont gérées par `FieldHints`.
- Niveaux : un dossier `content/<niveau>/programme.json` par niveau (chargé au démarrage) ; `content/<niveau>/cours/*.json` = cours prêts, publiés automatiquement s’ils n’ont encore aucune version.
- Bilan pédagogique : faits mesurés `src/lib/profile.ts`, bilan IA `src/lib/report.ts` (aucun prénom envoyé), test de positionnement `src/lib/placement.ts`, leçons à créer (`lesson_suggestions`).
- Dossier scolaire : table `student_years` (une année par ligne) ; `src/lib/school-years.ts`.
