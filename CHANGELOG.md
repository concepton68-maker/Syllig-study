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

## 0.03 — 23/11/2026
- Nouvel habillage « application » :
  - Barre latérale sombre aux couleurs du thème, avec icônes, compteurs, profil et déconnexion.
  - Sur téléphone, barre d'onglets en bas.
- Page de connexion en deux panneaux (présentation et formulaire).
- Cartes plus élégantes ; tableau de bord parent avec des tuiles de chiffres clés colorées, chacune avec son icône.

## 0.04 — 23/11/2026
- 4 nouveaux thèmes girly : Lavande, Pêche corail, Barbe à papa, Nuit étoilée (soit 6 thèmes girly au total).
- Choix du thème rangé par familles (Girly, Garçon, Neutres), avec un aperçu de la barre latérale de chaque thème.

## 0.05 — 23/11/2026
- Nouveau logo « livre-aurore » (un soleil qui se lève derrière un livre ouvert) :
  - « Syllig » en lettres à empattements, « STUDY » en capitales espacées.
  - Présent dans la barre latérale, la barre mobile et la page de connexion, ainsi que dans l'icône d'onglet du navigateur.
  - Couleurs adaptées à chaque thème.

## 0.06 — 24/11/2026
- Niveaux scolaires multiples et dossier scolaire :
  - Nouveau niveau **3e générale** (collège, cycle 4), avec le programme officiel : 191 cours dans 12 matières, les priorités tenant compte du brevet. La Seconde générale est conservée.
  - Kausar passe en 3e générale. Il s'agit d'une correction de niveau : son compte ne change pas.
  - **Dossier scolaire** de chaque élève, année après année :
    - côté parent, onglet « Dossier scolaire » de la fiche enfant ;
    - côté élève, page « Mon dossier scolaire ».
  - Changement de niveau, de deux façons :
    - passage dans une nouvelle année : l'année en cours est clôturée et son bilan archivé ;
    - correction du niveau de l'année en cours.
  - Matières suivies au choix pour chaque élève (par exemple une seule LV2).
  - Parcours qui fait alterner les matières, au lieu d'enchaîner tous les cours de français.
  - Catalogue de l'espace contenu filtrable par niveau. Le générateur de consignes prend un exemple du même niveau.
- Corrections issues des audits :
  - Espace élève :
    - Sur téléphone, le bas des pages n'est plus caché.
    - La leçon s'ouvre en haut de chaque page, et le lien « revoir la partie » mène à la bonne partie.
    - Le score des exercices est corrigé.
    - Points de progrès cumulés, avec des paliers.
    - Niveaux de maîtrise en couleurs progressives, et non plus en couleur d'alerte.
    - Textes neutres (élève fille ou garçon).
    - Pages « introuvable » et « erreur » en français.
  - Espace parent et contenu :
    - Comptes : messages de confirmation et retrait groupé avec confirmation.
    - Un seul style « danger » pour toutes les actions destructrices.
    - Libellés clarifiés : « Pas maintenant » au lieu de « Plus tard ».

## 0.07 — 24/11/2026
- **13 premiers cours de 3e générale**, publiés automatiquement. Chacun comprend :
  - une leçon en pages avec des points de contrôle ;
  - 10 exercices sur 3 niveaux ;
  - une évaluation sur 20, avec 2 sujets.
- Les cours par matière :
  - Français : classes de mots et fonctions ; phrase simple et phrase complexe ; propositions subordonnées relatives et conjonctives.
  - Mathématiques : relatifs et fractions ; puissances et notation scientifique ; nombres premiers.
  - Histoire : la Première Guerre mondiale ; violences de guerre et génocide des Arméniens.
  - EMC : la Constitution de la Ve République.
  - Physique-Chimie : atomes et molécules.
  - SVT : cellules, chromosomes et ADN.
  - Anglais : présent simple et présent en be + -ing.
  - Technologie : besoin et cahier des charges.
- Correction automatique : le signe moins typographique (claviers de téléphone) est accepté.
