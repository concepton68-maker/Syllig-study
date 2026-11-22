# Syllig Study

Plateforme de suivi scolaire pour les familles : parcours guidé (leçon → exercices → évaluation → corrigés), mesure du travail réel, évaluation motivante, tableau de bord parent. Premier niveau : Seconde générale (10 matières, 184 cours, hors EPS).

- Production : https://study.syllig.com (VPS 1, conteneurs Docker derrière Caddy) — voir [docs/INSTALLATION.md](docs/INSTALLATION.md)
- Stack : Next.js 15 + TypeScript, PostgreSQL 16, Docker Compose

## Contenu
- Programme : `content/seconde-generale/programme.json` (chargé au démarrage, idempotent)
- Cours : format `syllig-course/1` (`src/lib/course-format.ts`), exemple de référence `content/seconde-generale/cours/C001.json`
- Création d'un cours : Contenu → catalogue → « Préparer la consigne » → coller dans Claude → importer le JSON → relire → publier
- Vérifier un fichier hors plateforme : `npm run validate -- chemin/du/cours.json`

## Développement local
```
npm ci
export DATABASE_URL=postgres://syllig:syllig@localhost:5432/syllig
npm run migrate && npm run seed
npm run dev
```
Comptes : `node scripts/create-user.mjs admin` puis `node scripts/create-user.mjs family` (interactif).

## Tests de bout en bout
```
DATABASE_URL=… tests/reset-db.sh      # base de test + comptes de test
node tests/e2e-parcours.mjs            # import → élève → parent → validation
```

## Structure
- `db/migrations/` migrations SQL numérotées (appliquées au démarrage du conteneur)
- `src/lib/` règles métier : progression et niveaux de maîtrise, mesure d'activité, évaluations, corrections (export/import Claude), générateur de consignes
- `src/app/eleve`, `src/app/parent`, `src/app/contenu` : les trois espaces
- `deploy/` installation, sauvegarde
