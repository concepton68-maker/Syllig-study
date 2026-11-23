# Journal des versions — Syllig Study

Numérotation : 0.01, 0.02… (une version par mise en ligne). La version en ligne est visible sur la page de connexion et sur /api/version.

## 0.01 — 22/11/2026
Première version numérotée (déjà en ligne avant numérotation : socle, générateur de consignes, écran fixe, leçon en pages, onglets, thèmes, mises à jour automatiques).
- Numéro de version affiché dans l'application.
- Réinitialisation d'un cours pour un élève (tentatives, évaluations, exercices, points, progression) et réinitialisation complète d'un élève, depuis l'espace parent.
- Lifting complet après audit (3 agents : parcours par rôle, design, code et sécurité) :
  - Élève : menu « Aujourd'hui · Mes cours · Mes résultats · Mon espace », mes cours en onglets (À faire / Acquis / À venir), choix du thème dans « Mon espace ».
  - Parent : menu « Accueil · À faire · Activité · Enfants » ; page « À faire » qui regroupe demandes d'évaluation et copies à valider ; fiche enfant en onglets (Cours, Règles et thème, Compte, Repartir de zéro).
  - Contenu : « À relire », catalogue filtrable, « Comptes » pour donner l'accès contenu à un parent.
  - Un même compte peut être parent et administrateur, avec bascule d'espace dans la barre du haut.
- Thèmes revus : « Girly ✦ Ice blue » (thème de Léa, couleurs du pré-projet), « Framboise », « Graphite & Volt », « Lagon », « Classique ».
- Sécurité : limitation des essais de connexion, une seule évaluation ouverte à la fois, correction non validable deux fois, journal d'activité protégé contre les suppressions en cascade.
- Mises à jour automatiques plus robustes : la construction ne dépend plus de Docker Hub, 3 essais en cas de coupure réseau, et une version en échec est retentée (jusqu'à 3 fois) au lieu d'être abandonnée.

## 0.02 — 23/11/2026
- Numéro de version visible en haut de chaque écran (à côté du logo), et plus lisible sur la page de connexion.
- Actions groupées : cases à cocher + « Tout sélectionner » sur les listes de gestion.
  - Parent : réinitialiser plusieurs cours d'un coup, changer l'ordre de plusieurs cours, autoriser ou reporter plusieurs demandes d'évaluation, exporter seulement les copies choisies.
  - Contenu : publier plusieurs brouillons d'un coup (« À relire » et catalogue).
- Nom « Syllig Study » et « Se déconnecter » de nouveau lisibles sur les thèmes à barre sombre.
