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

## 0.08 — 24/11/2026
- Correction automatique plus juste :
  - Dans les réponses courtes, le signe moins, la barre de fraction et la virgule comptent : « -1/3 », « 1/3 » et « 1,3 » ne se confondent plus.
  - Les 323 réponses attendues des cours ont été revérifiées.
- Relecture « professeur » des cours de mathématiques, sciences, technologie et anglais. Quatre cours ont été précisés : plus de formulations acceptées, une règle d'orthographe anglaise complétée, des tournures clarifiées.
- Bibliothèque de cours : un cours corrigé est republié automatiquement en nouvelle version, sauf s'il a été modifié dans l'espace contenu.
- Espace parent :
  - Correction d'une copie : les points sont contrôlés avant l'envoi (plus aucune saisie perdue), avec le total en direct et une confirmation avant de rendre la note visible.
  - Ordre du parcours : les cours sont regroupés par matière, et le choix est enregistré aussitôt.
  - « Cours acquis » est calculé sur les cours disponibles.
  - Onglets de la fiche enfant lisibles sur téléphone.
- Espace contenu :
  - Confirmation et message à la publication.
  - Possibilité d'écarter un brouillon, seul ou en groupe.
  - Niveau affiché sur chaque cours.
  - Message après l'import de plusieurs fichiers.
- Numéro de version en haut de la barre latérale.

## 0.09 — 24/11/2026
- 4 nouveaux cours de 3e :
  - Mathématiques : fractions irréductibles et problèmes de partage.
  - Physique-Chimie : les ions.
  - Espagnol LV2 : le présent de l'indicatif.
  - Allemand LV2 : le présent et la place du verbe.
- Relecture « professeur » des cours de français, d'histoire et d'EMC :
  - Citations historiques rétablies dans leur texte exact.
  - Révision constitutionnelle du 8 mars 2024 (IVG) ajoutée.
  - Précision sur l'article 11 (référendum).
  - Nuance sur le « premier génocide du XXe siècle ».
  - Beaucoup plus de formulations acceptées dans les réponses courtes.

## 0.10 — 24/11/2026
- 5 nouveaux cours de 3e :
  - Français : les subordonnées circonstancielles.
  - Anglais : le prétérit simple et le prétérit en be + -ing.
  - Histoire : la révolution russe et l'URSS de Staline.
  - SVT : gènes, allèles et caractères.
  - Technologie : fonctions, solutions techniques et évolution des objets.
- Soit **22 cours de 3e générale** disponibles, couvrant toutes les matières principales et les deux LV2.

## 0.11 — 24/11/2026
- Correction d'affichage : le gras et l'italique s'affichent correctement, au lieu des astérisques bruts. C'était le cas dans :
  - les points de contrôle de la leçon ;
  - les choix de réponse des exercices et des évaluations ;
  - les objectifs ;
  - les bilans, les copies et l'aperçu du cours.
- Nouveau test : chaque cours de la bibliothèque est parcouru de bout en bout (leçon, exercices, évaluation, correction du parent). Les 22 cours de 3e obtiennent 20/20 avec les réponses du corrigé.

## 0.12 — 24/11/2026
- Relecture « professeur » des 9 cours de la deuxième vague :
  - Erreurs scientifiques corrigées (caractère acquis, cellule à plusieurs noyaux).
  - Tolérance trop large corrigée en technologie.
  - Une réponse espagnole qui était acceptée sans son accent, alors que l'accent change la forme, passe en QCM.
  - Un point de contrôle d'anglais qui avait deux bonnes réponses est corrigé.
  - Précisions historiques sur la Grande Terreur et sur la capitale de l'URSS.
  - « donc » est classé en adverbe, selon la terminologie 2020.
- Correction automatique : une unité ou « % » écrite après un nombre est acceptée (« 25 % », « 50 km »).
- Parent : les questions corrigées automatiquement sont ajustables, pour accorder des points partiels prévus au barème.
- Élève :
  - Mode concentration pendant l'évaluation : la navigation est masquée et une sauvegarde est faite en quittant la page.
  - Page du cours avec un bouton principal « Commencer / Continuer » et un retour à « Mes cours ».
  - Boutons avec un état « Un instant… ».
  - Titres de page accessibles.
  - Minuteur annoncé seulement à 5 min, 1 min et 10 s.
- Parent : l'enfant choisi est retenu d'une page à l'autre.
- Démarrage du site : un fichier de cours illisible est ignoré au lieu de bloquer le démarrage.

## 0.13 — 24/11/2026
- 8 nouveaux cours de 3e, soit **30 cours** de 3e générale :
  - Français : les temps de l'indicatif et leurs valeurs.
  - Mathématiques : racines carrées.
  - Histoire : l'Allemagne nazie et les démocraties fragilisées.
  - EMC : séparation des pouvoirs et laïcité.
  - Physique-Chimie : tests d'identification des ions.
  - SVT : la division cellulaire (mitose).
  - Anglais : present perfect (since, for, already, yet).
  - Technologie : impact environnemental et cycle de vie d'un objet.
- Chaque nouveau cours a été parcouru de bout en bout par le test automatique (20/20 avec le corrigé).

## 0.14 — 24/11/2026
- Espace contenu : nouvelle page **Programmes**. Pour chaque niveau, elle affiche les matières, les cours publiés sur le programme et le nombre d'élèves inscrits.
- Journal d'activité du parent : filtres (évaluations, leçons et exercices, actions du parent) et navigation vers les événements plus anciens.
- Exercices : les onglets indiquent les réponses rédigées qui restent à vérifier, et « Pas encore » a un style bien distinct.
- Niveaux : la 3e générale est bien rangée au collège, avant la Seconde.

## 0.15 — 24/11/2026
- Relecture « professeur » des 8 cours de la troisième vague :
  - Français : les réponses où seul l'accent fait la différence passent en QCM.
  - Histoire : une erreur corrigée sur le IIIe Reich, le texte des accords de Matignon précisé.
  - EMC : le Concordat de 1801 est mieux expliqué.
  - Mathématiques : ce qui dépasse le programme de 3e (produit et quotient de racines) passe en « Pour aller plus loin ».
  - Physique-Chimie : consignes de sécurité sur le chlorure de baryum.
  - Anglais : plus de formulations acceptées.
  - Ordre croissant rétabli dans les QCM numériques.
- Correction automatique : comparaison des décimaux fiabilisée (7,07 et 7,071 sont bien distingués).
- Les **30 cours de 3e** passent tous le test de bout en bout (20/20 avec le corrigé).

## 0.16 — 24/11/2026
- Espace élève : les textes qui expliquaient ce que les parents voient ou ne voient pas sont supprimés. Cela concerne :
  - la page « Mon espace » ;
  - les consignes de l'évaluation ;
  - le message affiché en quittant la fenêtre ;
  - le bilan.

## 0.17 — 24/11/2026
- **Zone grise sous le contenu supprimée.**
  - Cause : un libellé invisible des QCM, prévu pour les lecteurs d'écran, sortait de la zone qui défile et agrandissait la page entière.
  - La page ne peut plus défiler ni « rebondir » sur téléphone et tablette.
  - L'application garde toute la hauteur de l'écran après la fermeture du clavier (Firefox Android).
  - 44 pages vérifiées sur téléphone et sur ordinateur : aucune ne dépasse de l'écran.
- **Barre d'avancement des questionnaires** (exercices et évaluation) :
  - Toute la largeur, en haut, avec « X / 10 questions répondues ».
  - Bouton « Prochaine question sans réponse », qui y amène directement.
  - Sur téléphone, la barre reste visible en haut de l'écran pendant le défilement.
  - Les questions déjà répondues ont un contour coloré.
- Exercices : la consigne passe dans la liste des questions, ce qui laisse plus de place aux questions sur les petits écrans.
- Le défilement compte désormais comme une activité : la fenêtre de pause n'apparaît plus pendant la lecture.

## 0.18 — 24/11/2026
- **Départ à zéro pour Kausar**, à la demande du parent. Sont effacés :
  - l'avancement des cours, les leçons, les exercices, les évaluations et les notes ;
  - les points, les séances et le journal d'activité.
- Le dossier scolaire de l'année 2026-2027 en 3e générale repart d'aujourd'hui, et le nouveau journal commence par « Parcours réinitialisé ».
- Le compte, le mot de passe, le niveau (3e générale), les réglages et le thème sont conservés.

## 0.19 — 24/11/2026
Recette complète de l'espace élève (un agent testeur a joué l'élève sur téléphone et sur ordinateur). Corrections :
- **Aucune réponse perdue** (exercices et évaluation) :
  - enregistrement moins d'une seconde après la frappe, et au départ de la page (Quitter, onglet, rechargement) ;
  - le serveur fusionne les réponses au lieu de les remplacer : une page rechargée ne peut plus effacer une réponse ;
  - la page relit les dernières réponses enregistrées à l'ouverture.
- « Refaire les exercices » repart d'un questionnaire vide.
- Leçon : le bouton « Suivant » se débloque dès que le point de contrôle est réussi.
- Dossier scolaire lisible sur téléphone, sans débordement.
- Ordinateurs à écran peu haut : en-têtes compacts, la zone de questions gagne 50 %.
- Détails :
  - une leçon commencée affiche « Leçon en cours » et « Continuer » ;
  - pendant une demande d'évaluation, l'accueil indique « en attente de l'accord » ;
  - « +50 points » n'est annoncé qu'au moment où ils sont gagnés ;
  - une réponse vide ne peut plus être cochée « Réussi » ;
  - recharger la page n'est plus compté comme une sortie de fenêtre ;
  - les tableaux des leçons sont lisibles sur téléphone ;
  - page « introuvable » en français ;
  - le total de la copie s'affiche dès l'ouverture côté parent ;
  - l'onglet du bas s'appelle « Thème ».
- Nouveaux tests :
  - `e2e-eleve-scenarios.mjs` : accord du parent, fin du temps, export et import, révision, 2e tentative ;
  - `e2e-sauvegarde.mjs` : aucune réponse perdue.

## 0.20 — 24/11/2026
- **Fin de l'erreur « Application error: a client-side exception »** après une mise en ligne.
  - Cause : une page restée ouverte pendant une mise à jour appelait des fonctions de l'ancienne version, inconnues du nouveau serveur.
  - Désormais, la page le détecte et se recharge d'elle-même, une seule fois, sur la nouvelle version. Les réponses sont déjà enregistrées.
  - Reproduit puis vérifié : une leçon ouverte sur l'ancienne version, une mise en ligne, puis un clic sur le point de contrôle. La page se recharge proprement au lieu de planter.
- Page d'erreur générale en français (« Un instant… »), avec un bouton pour recharger la page.
- Espace contenu : page d'erreur dédiée.

## 0.21 — 24/11/2026
- Évaluation : « Remettre ma copie » remet la copie tout de suite. La confirmation s'affiche dans la page (« Oui, remettre » / « Continuer ») au lieu d'une fenêtre du navigateur : Firefox pouvait bloquer cette fenêtre sans rien dire, et la copie restait coincée jusqu'à la fin du chrono. Si la remise échoue (connexion coupée), un message invite à réessayer, sans rien perdre.
- Même confirmation dans la page pour « Voir les corrigés » (exercices incomplets), « Refaire les exercices » et la publication ou l'écartement d'un cours.
- Mot de passe oublié :
  - lien « Mot de passe oublié ? » sur la page de connexion ;
  - compte élève : la demande arrive chez le parent, dans « À faire » (avec la pastille), où il choisit le nouveau mot de passe ; actions groupées pour marquer des demandes comme réglées ;
  - compte parent : la demande arrive dans Contenu › Comptes ; l'administrateur crée un lien à usage unique (48 h) à envoyer par SMS ou messagerie, et le parent choisit lui-même son nouveau mot de passe ;
  - même réponse que l'identifiant existe ou non, demandes limitées ; un changement de mot de passe ferme les sessions ouvertes ailleurs.
- « Mon mot de passe » (icône clé dans la barre) : chaque compte peut changer son mot de passe.
- Petits téléphones : la barre du haut ne déborde plus pour un compte à deux espaces (Famille + Contenu).

## 0.22 — 24/11/2026
- Contenu › Comptes : nouvelle vue « Familles et comptes ». L'administrateur voit toutes les familles, chaque parent et chaque élève avec son identifiant de connexion, son niveau, sa dernière connexion et le nombre d'appareils connectés.
- Sur chaque compte (adulte ou élève) : « Lien nouveau mot de passe » (lien à usage unique, 48 h).
- Actions groupées : « Déconnecter de tous les appareils » et « Donner l'accès Contenu » (les comptes élèves sont ignorés).

## 0.23 — 24/11/2026
- IA de correction branchée (Contenu › IA de correction) : au choix Claude (Anthropic) ou Gemini (Google). La clé est vérifiée auprès du fournisseur, puis enregistrée chiffrée. Pour Gemini, la liste des modèles vient de la clé.
- Famille › À faire : bouton « Corriger avec l'IA » (toutes les copies en attente) et action groupée « Corriger la sélection avec l'IA ». L'IA propose les points et les commentaires des réponses rédigées ; seules les réponses partent chez le fournisseur, sans le nom de l'élève.
- Action groupée « Valider les notes proposées » : valide d'un coup les copies pré-corrigées (on peut toujours vérifier et ajuster chaque copie avant).
- L'export / import manuel pour Claude reste disponible.

## 0.24 — 24/11/2026
- IA de correction : après « Vérifier et enregistrer », le fournisseur choisi (Gemini) reste coché. Avant, le formulaire se remettait sur « Claude » alors que Gemini était bien enregistré.
- Gemini : Google laisse dans sa liste des modèles retirés, qui répondent « 404 » (ex. gemini-2.5-flash). La plateforme essaie désormais vraiment le modèle avant de l'enregistrer et choisit le « Flash » le plus récent qui répond. Si Google retire un modèle plus tard, la correction passe seule sur un autre et le signale.
- Les messages d'erreur de Google sont affichés en clair.

## 0.25 — 24/11/2026
- Plus aucune fenêtre du navigateur (« study.syllig.com indique… ») : toutes les confirmations s'affichent dans une fenêtre aux couleurs de l'application, avec un titre clair, une précision et un bouton qui dit ce qu'il fait (ex. « Valider 9,75/20 »). Échap ou « Annuler » ferment sans rien faire. Sur téléphone, la fenêtre s'ouvre en bas de l'écran, avec de grands boutons.
- Concerné : validation et modification d'une note, changement de niveau ou d'année, toutes les actions groupées, publication et écartement des cours, « Refaire les exercices ».
- Bulles des formulaires : à la place de « Veuillez renseigner ce champ » du navigateur, un message en français sous le champ (« Ce champ est à remplir », « Au moins 8 caractères »…), qui disparaît dès que l'on tape.
- Infobulles (icônes clé et déconnexion, version, « Pas maintenant »…) aux couleurs de l'application.

## 0.26 — 24/11/2026
- Famille › Bilan (nouveau) :
  - « Ce que montrent les chiffres » : pour chaque cours, temps réel de leçon comparé à la durée prévue, points de contrôle réussis du premier coup, exercices, évaluation (note, temps utilisé, questions vides). Signaux clairs : leçon survolée, évaluation bâclée, copie vide, écart exercices / évaluation, distraction.
  - « Bilan par l'IA » : synthèse, origine probable des difficultés (lacunes des années précédentes, notions de cette année, manque d'implication, ou pas encore possible de trancher) avec les preuves chiffrées, implication, matière par matière, bases à consolider, conseils pour les parents, limites et niveau de confiance. Aucun prénom n'est envoyé à l'IA. Historique des bilans, avec suppression groupée.
  - « Test de positionnement » : préparé par le bilan sur les bases des années précédentes, proposé à l'élève en un clic, corrigé automatiquement. Résultats par notion et par niveau, avec une alerte si le test a été fait trop vite. Le bilan suivant en tient compte.
- Élève : le test apparaît dans « Aujourd'hui ». Réponses enregistrées au fil de l'eau, chrono, mode concentration, puis correction expliquée.
- Contenu › Leçons à créer (nouveau) : les leçons de rattrapage proposées par les bilans, regroupées (« proposée 2 fois »), sans nom d'élève. Actions groupées : marquer comme créées, écarter, remettre à créer.
- Téléphone : la barre d'onglets de l'espace Contenu tient sur une ligne.

## 0.27 — 24/11/2026
- Mistral (France, données traitées dans l'Union européenne) ajouté comme fournisseur d'IA, à côté de Claude et Gemini.
- Contenu › IA : une clé par fournisseur, chacune vérifiée puis chiffrée, et une IA par tâche (correction, bilan). Mistral Small est conseillé pour les corrections, Mistral Large pour les bilans.
- RGPD :
  - Règle Europe : les données d'élèves ne partent que chez un fournisseur européen, sauf dérogation explicite de l'administrateur. L'ancien réglage Gemini est bloqué jusqu'à cette dérogation, et une clé Mistral le remplace d'office.
  - Consentement du parent par enfant, séparé pour la correction et pour le bilan, désactivé par défaut (Famille › Bilan › Confidentialité et IA). Sans accord, rien n'est envoyé.
  - Nettoyage avant envoi : prénoms, identifiants, e-mails, téléphones et adresses sont retirés des réponses, y compris dans l'export manuel pour Claude.
  - Journal des envois : le parent voit exactement ce qui est parti, chez qui (UE ou hors UE) et quand. Il peut effacer des lignes en groupe.
  - Conservation : les bilans, les tests terminés et le journal sont effacés automatiquement après 6 mois, 1 an ou 2 ans (réglable).
  - Page publique « Confidentialité » (lien sur la page de connexion) : données, finalités, fournisseurs en service, durées, droits, CNIL.

## 0.28 — 24/11/2026
- Automatismes, réglés par le parent pour chaque enfant (Famille › Bilan › Confidentialité et IA), uniquement avec son accord :
  - correction par l'IA dès la remise d'une copie (le parent valide toujours la note) ;
  - bilan automatique, toutes les 3 évaluations notées ou chaque semaine s'il y a eu du travail ;
  - test de positionnement proposé automatiquement à l'élève après un bilan.
- Rédaction des cours par l'IA (nouvelle tâche « Rédaction des cours », aucune donnée d'élève envoyée) :
  - Catalogue : bouton « Rédiger avec l'IA » sur chaque cours et action groupée. Le cours est rédigé en arrière-plan, contrôlé par le validateur (second essai automatique s'il est refusé), puis placé en brouillon dans « À relire ». Rien n'est publié sans validation.
  - Leçons à créer : « Rédiger avec l'IA » range chaque leçon dans un chapitre « Remise à niveau » au niveau de l'élève, puis la fait rédiger. À la publication, la leçon passe en tête du parcours des élèves concernés.
  - Option administrateur : rédiger automatiquement les leçons de rattrapage proposées par les bilans.
- Contenu › IA : section « Travail en arrière-plan » (tâches en attente, en cours, terminées, en échec ; relancer ou retirer en groupe ; « Vérifier les automatismes maintenant »).
- À faire : « Correction IA en cours… » sur les copies en traitement ; actions groupées disponibles dès la première copie.

## 0.29 — 24/11/2026
- Rédaction des cours par l'IA, beaucoup plus fiable :
  - Réponse reçue au fil de l'eau (Mistral et Gemini, comme déjà pour Claude). Avant, une rédaction de plus de 5 minutes était coupée en silence puis recommencée, jusqu'à 3 fois.
  - Deux files séparées : les corrections et bilans ne restent plus bloqués derrière la rédaction d'un cours.
  - Au redémarrage du serveur, une tâche interrompue repart aussitôt (avant : 20 minutes d'attente).
  - Avancement visible : « essai 1/2 · environ 40 % rédigé », temps écoulé, erreur précédente.
- Les pages (Catalogue, Leçons à créer, À faire, IA) se mettent à jour toutes seules pendant qu'une tâche IA tourne : plus besoin de F5.

## 0.30 — 24/11/2026
- Cours par export / import avec Claude (claude.ai, sans clé d'API), vérifié de bout en bout en 9 clics. Une seule consigne couvre la leçon, les exercices corrigés et l'évaluation (2 sujets, 20 points, barèmes).
- Leçons à créer : « Ajouter au catalogue » range la leçon dans le chapitre « Remise à niveau » sans IA. Chaque leçon a ensuite son bouton « Préparer la consigne », puis « Brouillon importé : à relire ». À la publication, la leçon passe en tête du parcours des élèves concernés et la suggestion est marquée créée.
- Réglages de la consigne proposés automatiquement, avec l'explication :
  - durée de la leçon et temps imparti de l'évaluation selon le niveau ;
  - temps de rédaction en plus pour le français et l'histoire ;
  - format court et très guidé pour les remises à niveau ;
  - plus d'exercices pour les notions prioritaires.
  Ils restent modifiables, avec « Revenir aux réglages proposés ». La rédaction par l'IA utilise les mêmes réglages.
- Page de relecture d'un cours : carte « Paramètres du cours », avec les valeurs du fichier, qui sont celles appliquées aux élèves. Une alerte n'apparaît que si c'est pertinent pour l'élève : temps imparti différent de celui demandé (c'est son chrono), un seul sujet, barème différent de 20, moins de 5 exercices, leçon deux fois trop longue ou trop courte.

## 0.31 — 24/11/2026
- Contenu › IA : « + Ajouter un fournisseur d'IA » pour toute API compatible OpenAI (GLM / Z.ai, OpenAI, DeepSeek, OVHcloud, Scaleway, Infomaniak…).
  - On indique : nom, adresse de l'API (complète, même sans « /v1 »), clé, lieu de traitement des données.
  - Les modèles peuvent être saisis à la main si le fournisseur ne publie pas sa liste ; chacun est vérifié par un vrai essai.
  - Le fournisseur se retire en un clic.
- Règle RGPD inchangée : un fournisseur hors UE est utilisable librement pour la rédaction des cours (aucune donnée d'élève), et pour la correction ou le bilan seulement avec la dérogation. Un fournisseur ajouté n'est jamais choisi d'office pour des données d'élèves.
- Le lieu de traitement est affiché partout : page IA, Famille › Bilan, journal des envois, page Confidentialité.
- Sécurité : les formulaires de clés restent inactifs tant que la page n'est pas prête. Avant, un clic trop rapide pouvait mettre la clé dans l'adresse de la page.

## 0.32 — 24/11/2026
- Contenu › IA, page repensée :
  - Seuls les fournisseurs enregistrés s'affichent. « + Ajouter un fournisseur » ajoute une ligne : on choisit le fournisseur dans la liste, on colle la clé, on coche ses fonctions. Liste : Mistral, Claude, Gemini, GLM (Z.ai), OpenAI, DeepSeek, Scaleway, OVHcloud, ou « Autre » (API compatible OpenAI). L'adresse et le lieu de traitement sont préremplis.
  - Sur chaque fournisseur, « Utilisé pour » : une case par fonction, avec le modèle choisi (le plus adapté est proposé). Une fonction n'a qu'un fournisseur, et la page indique celui qu'elle remplace.
  - Règle RGPD visible : chez un fournisseur hors UE, les fonctions avec données d'élèves sont grisées tant que la dérogation n'est pas accordée. Retirer la dérogation retire ces fonctions des fournisseurs hors UE.
  - « Réglages généraux » : dérogation, rédaction automatique des leçons de rattrapage, conservation, IA active.
  - « Remplacer la clé » sur chaque fournisseur, et « Retirer ».
- Les fonctions attribuables forment une liste centrale extensible : une nouvelle fonction apparaîtra d'elle-même sur la page, dans la règle Europe et sur la page Confidentialité.

## 0.33 — 24/11/2026
- Page Contenu › IA réorganisée par fonction, la plus simple à comprendre :
  1. **Qui fait quoi** : une ligne par fonction (correction, bilan, rédaction des cours…), avec l'IA qui s'en charge et son modèle. Une IA hors UE apparaît verrouillée (🔒) pour les fonctions avec données d'élèves, et une attribution devenue interdite est signalée « ⚠ bloqué ».
  2. **Mes clés** : une ligne par fournisseur (clé ✓, lieu de traitement, fonctions assurées), avec « Changer la clé », « Retirer » et « + Ajouter une clé » (fournisseur dans la liste, puis clé). L'adresse d'API et le modèle sont rangés dans « Options avancées », sauf pour « Autre », où ils sont indispensables.
  3. Réglages généraux. 4. Travail en arrière-plan.
- La liste des fonctions reste centrale et extensible : une nouvelle fonction ajoute d'elle-même une ligne à « Qui fait quoi ».

## 0.34 — 24/11/2026
- Qui fait quoi : la liste « Fournisseur » de chaque fonction propose tous les fournisseurs, pas seulement ceux qui ont déjà une clé. Pour un fournisseur sans clé, le champ « Collez la clé » et le bouton « Vérifier » apparaissent directement dans la ligne ; le modèle se règle ensuite tout seul.

## 0.35 — 24/11/2026
- Relecture d'un cours existant par l'IA :
  - Sur la page d'un cours, « Relire avec l'IA » : l'IA relit comme un inspecteur (erreurs de fond, corrigés faux, barèmes, adéquation au niveau). Elle rend un verdict (publiable, à corriger, à réécrire) et les problèmes classés par gravité, chacun avec l'endroit, le constat et la correction à faire.
  - « Faire corriger par l'IA » : une version corrigée arrive en brouillon dans « À relire » ; la version publiée reste en place.
  - Catalogue : « Relire avec l'IA » dans le menu de chaque cours et en action groupée.
  - Nouvelle fonction « Relecture et correction des cours » dans Qui fait quoi ; sans choix, elle utilise la même IA que la rédaction.
- Catalogue redessiné en tableau : colonnes Code, Cours, Statut, Actions alignées.
  - Statut : publié, à relire ou sans contenu, puis l'état de l'IA ou le résultat de la relecture.
  - Un seul bouton principal par ligne, les autres actions dans le menu « ⋯ ».
  - « Prioritaire » est discret, dans la ligne de description.

## 0.36 — 24/11/2026
- Rédaction de cours avec GLM et les autres fournisseurs compatibles OpenAI, plus robuste :
  - si le fournisseur refuse le « mode JSON » ou une réponse aussi longue, la plateforme réessaie sans, au lieu d'échouer ;
  - la réflexion des modèles qui « réfléchissent » avant d'écrire (ex. GLM) est prise en compte : « l'IA réfléchit avant d'écrire… » au lieu d'un blocage apparent ;
  - les erreurs signalées par le fournisseur en cours de route remontent en clair ;
  - si la réponse ne contient pas de JSON, le message d'échec montre son début.
- Mes clés :
  - bouton « Tester » sur chaque clé : temps de réponse, réponse structurée, réception au fil de l'eau, ou l'erreur exacte avec une piste (crédit épuisé, clé « Coding Plan » qui demande une autre adresse, modèle introuvable…) ;
  - pour un fournisseur ajouté, « Changer la clé ou l'adresse » permet aussi de corriger l'adresse de l'API.

## 0.37 — 25/11/2026
- Parent : nouvel écran « En direct » (menu) pour suivre l'activité de l'élève :
  - état à l'instant, rafraîchi toutes les 10 secondes sans recharger : « En train de travailler », « En pause » ou « Hors ligne », depuis quand, sur quel cours, minutes effectives de la séance ;
  - frise de la journée heure par heure : blocs de travail effectif et de pause, détail au survol, repère « maintenant » ;
  - 7 derniers jours : travail effectif et pauses par jour, ligne d'objectif quotidien, tableau des chiffres ;
  - indicateurs de la semaine : travail effectif, concentration (part du temps réellement actif), régularité, séance moyenne, sorties de fenêtre pendant les évaluations ;
  - répartition du travail sur 30 jours par activité (leçons, exercices, évaluations) et par matière.
- Accueil parent : pastille d'état en direct qui mène à cet écran.
- Les signaux d'activité (toutes les 15 s) sont conservés 90 jours puis effacés.

## 0.38 — 25/11/2026
- Bilan parent : nouvelle carte « Ne veut pas, ou n'arrive pas ? » :
  - deux mesures séparées sur 4 semaines : l'investissement (régularité, temps de travail, concentration, lecture des leçons, effort pendant les évaluations) et la compréhension (points de contrôle, exercices, évaluations, test de positionnement) ;
  - la compréhension n'est calculée que sur le travail fait sérieusement : une évaluation rendue trop vite ou à moitié vide compte dans l'investissement, pas dans la compréhension, et c'est signalé ;
  - carte à quatre zones (sur de bons rails, n'arrive pas, ne veut pas, à relancer), un point par matière, le profil actuel et ce qui aide le plus pour ce profil ;
  - niveau de fiabilité affiché ; pas de profil tant qu'il y a trop peu de travail ;
  - alerte « activité en baisse », et « possible découragement » quand la baisse suit une note faible.
- Le bilan rédigé par l'IA reçoit ces deux mesures pour distinguer l'élève qui ne veut pas de celui qui n'arrive pas.
- Écran « En direct » : résumé investissement / compréhension qui mène au bilan.
- Téléphones et tablettes : en-tête des leçons, exercices et évaluations plus compact ; barre « question sans réponse » sur une ligne ; onglets de parties sur une ligne qui glisse au doigt ; en paysage, le minimum au-dessus des questions.

## 0.39 — 25/11/2026
- Collège complet : programmes de 6e (148 cours), 5e (169 cours) et 4e (178 cours), d'après les textes officiels en vigueur en 2026-2027 (nouveaux programmes de français et de mathématiques en 6e et en 5e ; programme du cycle 4 de 2020 en 4e), avec les cours prioritaires du début d'année.
- Parent, « Enfants » : ajout d'un enfant plus complet :
  - fille ou garçon (thème proposé en conséquence), mois et année de naissance ;
  - classe proposée automatiquement selon l'âge, toujours modifiable ; un écart (redoublement, avance) est signalé sans bloquer ;
  - tiers-temps aux évaluations pour un enfant avec aménagement (PAP, PPS) : durée majorée d'un tiers, chrono du serveur compris.
- Fiche de l'enfant, « Règles et thème » : profil scolaire modifiable (naissance, fille ou garçon, tiers-temps).
- Liste des enfants : âge et aménagement visibles.
- Contenu, catalogue : s'ouvre sur le niveau où il y a le plus de cours publiés ; la recherche porte sur tous les niveaux (le niveau est indiqué sur chaque ligne).

## 0.40 — 25/11/2026
- Test de rentrée pour chaque classe (6e, 5e, 4e, 3e, Seconde) : 24 questions sur les bases des années précédentes (maths, français, anglais), écrites à l'avance et corrigées automatiquement, sans IA ni donnée envoyée.
  - Proposé d'emblée quand le parent ajoute un enfant (case cochée par défaut), ou à tout moment depuis le Bilan.
- Questionnaire « Comment tu travailles ? » pour l'élève (2 minutes, 14 phrases + 2 questions libres facultatives), au début puis toutes les 6 semaines, jamais en même temps qu'un test :
  - le parent voit dans le Bilan son ressenti : envie d'apprendre, sens, pression, confiance, stress, organisation, aide disponible, conditions de travail ; les points d'attention sont signalés avec ce qui aide ; l'évolution depuis la fois précédente ;
  - « Lui reproposer maintenant » ;
  - le bilan IA reçoit les scores (jamais les phrases libres).
- Motivation (approche « soutien plutôt que contrôle ») :
  - l'élève peut choisir lui-même son prochain cours (« Ou choisis toi-même ») ;
  - après une évaluation, l'effort est souligné autant que la note (temps pris, tout tenté), avec un conseil quand la copie est rendue trop vite ou laissée vide ;
  - « Mes progrès » dans ses résultats : lui par rapport à lui-même (temps de travail, niveaux gagnés, plus belle remontée), jamais de comparaison avec d'autres.
- 6 premiers cours de 4e publiés (leçon, exercices, évaluation) : classes de mots et fonctions, accord du participe passé, multiplier et diviser des relatifs, additionner et soustraire des fractions, réduire une expression littérale, Pythagore (calculer une longueur).
- Correction automatique plus juste pour les réponses courtes : les signes + et − d'une expression et les exposants comptent désormais (« 5x+9 » n'est plus accepté pour « 5x−9 », ni « 3x » pour « 3x² ») ; « 3 x » = « 3x », et les mots composés (« peut-être ») restent tolérants.

## 0.41 — 25/11/2026
- Exercices : l'élève n'est plus jamais bloqué avant l'évaluation. « Enregistrer mon résultat » est toujours disponible ; les réponses rédigées non comparées au corrigé comptent « Pas encore », avec un avertissement clair et un bouton « Prochaine à comparer » qui y mène directement (même dans un autre onglet).
- Parent, « Activité » : journal regroupé jour par jour, un bloc par cours : où l'élève en est arrivé (leçon, contrôles, exercices, note), son temps effectif, ce qui mérite d'en parler ; le détail minute par minute se déplie ; pages de 7 jours.
- Parent, « Bilan » : « Où va-t-il ? », la trajectoire sur 12 semaines :
  - investissement semaine par semaine et compréhension (3 semaines glissantes, travail sérieux seulement), avec tendance (en hausse, stable, en baisse) et une lecture en clair ;
  - « Dans quoi il progresse » : une courbe par matière ;
  - son ressenti d'un questionnaire à l'autre (envie, confiance, stress, organisation) ;
  - la semaine en cours est comptée au prorata des jours écoulés et tracée en pointillés.
- Site d'essai (préparé) : une copie séparée de l'application sur le même serveur (« essai.study.syllig.com »), avec sa propre base recopiée chaque nuit depuis les vraies données, IA désactivée et bandeau « Site d'essai ». Les nouveautés y passent d'abord, sans jamais toucher au travail des élèves. Il s'active dès que l'adresse existe dans le DNS.

## 0.42 — 25/11/2026
Principe du propriétaire : on ne montre que ce qui est mesuré de façon sûre, jamais d'estimation ni d'interprétation. Corrections issues de l'audit de conformité.
- Valeurs fausses corrigées :
  - jours travaillés comptés par jour (temps cumulé de la journée), et non plus par séance ;
  - « En direct » : les indicateurs portent sur les 7 derniers jours civils (plus de « 8/7 ») ;
  - tiers-temps : la durée réellement accordée (échéance du serveur) sert partout, y compris dans le bilan de l'élève (« remise en 40 min sur 40 ») ;
  - « Mes progrès » : la plus belle remontée ne mélange plus deux cours de même titre ; les niveaux gagnés comptent tous les niveaux franchis ;
  - semaines calculées à l'heure de Paris, sans heure perdue ni comptée deux fois aux changements d'heure ;
  - correction automatique : une réponse sans chiffre n'est jamais acceptée pour un nombre ; « 3² » n'est plus confondu avec « 32 » ; une question générée sans réponse est écartée.
- Bilan, « Travail et résultats » (remplace « Ne veut pas, ou n'arrive pas ? ») : uniquement des faits sur 28 jours, chacun avec sa définition — jours travaillés, temps effectif, part du temps où il agit sur la page, leçons terminées, copies complètes ou non, moyenne des copies complètes et des incomplètes séparément, contrôles réussis du premier coup, exercices corrigés par la plateforme (l'auto-évaluation de l'élève comptée à part), le tout par matière. Plus de score composite, de profil ni de « fiabilité ».
- Bilan, « Évolution sur 12 semaines » : temps et jours travaillés par semaine, réussite aux contrôles et aux exercices par semaine (avec le nombre de questions), comparaison chiffrée des 4 dernières semaines terminées avec les 4 précédentes, chaque résultat par matière dans l'ordre. Plus de tendance extrapolée ni de cause supposée.
- Questionnaire : le parent lit les réponses exactes de l'élève (et ce qui a changé depuis la fois précédente), sans pourcentage ni interprétation.
- « Concentration » renommée « Temps où il agit sur la page », avec sa définition.
- Révisions : chaque révision mène aux exercices du cours ; refaire les exercices la marque comme faite (« Révision faite » dans le journal).
- Bilan de l'élève : « Ce que tu as réussi dans cette évaluation » (au lieu de « Ce que tu sais faire maintenant »).
- Le bilan IA reçoit ces faits et les réponses exactes du questionnaire, avec la consigne de ne jamais conclure à un trait psychologique.

## 0.43 — 25/11/2026
Contre-audit de conformité de la 0.42 : corrections, et application de la règle « ne montrer que ce qui est sûr ».
- « Évaluations faites en entier » compte toutes les copies remises, notées ou non (une copie vide en attente de note était oubliée).
- Temps de leçon limité aux 28 jours affichés.
- Évolution sur 12 semaines : les semaines antérieures à la première activité affichent « — » (plus de comparaison avec des zéros) ; chaque pourcentage indique son effectif (« 68 sur 80 ») ; aucun pourcentage sous 5 questions ; par matière, les séries d'exercices et les notes des copies sont listées telles quelles, sans moyenne ni comparaison ; le questionnaire montre tout changement de réponse.
- Bilan par l'IA : plus d'« origine probable », de « niveau d'implication » ni de « confiance » déclarée par le modèle ; une notion n'est « à revoir » que si une erreur précise la montre.
- Test de positionnement : score par matière et liste des questions ratées comme « pistes à vérifier » (une question par notion ne prouve pas qu'elle n'est pas sue).
- Exercices : la note retenue (maîtrise, parent, journal) ne compte que les questions corrigées par la plateforme ; l'auto-évaluation de l'élève est affichée à part.
- Un seul « jour travaillé » partout : 10 minutes de temps effectif cumulé dans la journée.
- « En direct » : « Actif sur une page de travail », « Page ouverte, sans geste », « Aucune page de travail ouverte » ; plus d'objectif quotidien inventé ni de « séance moyenne ».
- Correction automatique : nombres lus strictement (décimal, fraction a/b, unité ou % après ; refus de « 0x10 », « 1e3 », des réponses sans chiffre) ; 67 cas vérifiés.
- Textes : plus de « travaille vraiment » ; chaque mesure de temps rappelle sa définition (geste dans les 60 s).

## 0.44 — 25/11/2026
- Site d'essai retiré (décision du propriétaire) : à la première mise à jour, le serveur supprime ce qui avait été installé à côté du site des élèves (conteneurs et base de l'essai, copie de travail, bloc Caddy), sans toucher au site des élèves. Plus de bandeau ni de réglage « essai » dans l'application.

## 0.45 — 25/11/2026
- Parent, « Activité » refaite d'après la maquette validée : la semaine (lundi → dimanche), avec navigation semaine par semaine.
  - « La semaine en 3 lignes » : ce qui a été fait (jours travaillés, temps actif, objectif), un point précis (copie incomplète, révision en retard, semaine sans travail ou questions ratées), une idée concrète liée à ce point ;
  - temps actif jour par jour, calendrier des 4 dernières semaines, anneau de l'objectif, temps par matière et par activité ;
  - « Ce qui a été travaillé » : un cours par ligne (leçon, exercices, évaluation, temps actif), en fiches sur téléphone ;
  - « Questions ratées cette semaine » : la question, la réponse de l'enfant et la bonne réponse ;
  - « À venir » (révisions, prochain cours) et « À regarder ensemble » (faits seulement).
- L'ancien journal reste accessible : « Voir le détail minute par minute ».
- Audit de conformité de la page appliqué avant la mise en ligne : une copie n'est signalée que pour ses questions sans réponse (plus de « copie incomplète » sur une copie remplie) ; une question ratée n'apparaît qu'une fois (dernière copie et dernière série d'exercices de chaque cours) et seulement à 0 point ; minutes affichées cohérentes avec le seuil de 10 min ; répartitions dont la somme fait le total (et 100 %) ; points et révisions en retard datés de la semaine affichée ; jours comptés sur les jours écoulés ; libellés exacts (« 8 justes sur 10 (corrigées par la plateforme) », « page de l'évaluation masquée ») ; sources citées précisément.

## 0.46 — 25/11/2026
Contre-audit de conformité des versions 0.43 à 0.45 : tout ce qui a été relevé est corrigé.
- Exercices : les notes enregistrées avant la 0.43 (qui comptaient l'auto-évaluation) sont recalculées à partir des seules questions corrigées par la plateforme ; libellé « Exercices, meilleure série (corrigés par la plateforme) ».
- Copies : une seule définition partout, sans seuil caché — « copies sans question vide » et, à part, « temps utilisé sur temps accordé » (tiers-temps compris) ; moyennes séparées des copies sans question vide et avec questions vides ; copies en attente comptées par matière.
- Temps de leçon : le même partout (tout le temps actif passé sur la leçon) ; plus de « Temps de leçon correct ».
- Bilan : sous-titre sans « d'où viennent les difficultés » ; les anciens bilans IA (ancienne consigne qui supposait des causes) ne s'affichent plus par défaut et sont signalés ; l'IA ne reçoit plus de codes interprétatifs ; « Réussi / Raté dans les copies » au lieu d'« Acquis / À reprendre ».
- Activité : « Un point précis » porte sur la dernière copie de chaque cours (comme la ligne du cours) ; le total affiché est la somme des barres, et les minutes par cours et par matière en sont une répartition exacte ; la source n'apparaît que sous l'idée qu'elle concerne ; le lien vers le détail garde la semaine ; « réponse attendue » précise les autres formes acceptées et la tolérance ; une adresse de semaine invalide n'affiche plus d'erreur.
- Évolution sur 12 semaines : pas de flèche sur moins de 3 copies de chaque côté ; une semaine où l'activité commence en cours de route n'entre pas dans la comparaison.
- Accueil parent : plus de « points de progrès » (score composite) ; la moyenne des évaluations indique sa période.
- En direct : minutes arrondies vers le bas comme ailleurs ; 30 derniers jours civils ; libellés sans « séance ».
- Correction automatique : « 2² » n'est plus accepté pour 2 ; « 5 m.s-1 » est accepté pour 5.
- Mise à jour du serveur : le nettoyage de l'ancien site d'essai ne garde plus le verrou de mise à jour, et ne recharge Caddy que si le bloc du site des élèves est toujours présent.

## 0.47 — 26/11/2026
- Activité (parent), selon la maquette validée : 3 chiffres seulement (temps de travail face à l'objectif, jours travaillés, temps par matière), puis **ce que l'enfant a fait, jour par jour** : heure, cours, durée, résultat. Filtres Leçons / Exercices / Évaluations.
- **Revoir ensemble** : bouton « Revoir » sur chaque série d'exercices et chaque copie. Chaque question montre la réponse de l'enfant à côté du corrigé, avec les points ; filtre « À revoir » / « Toutes ».
- Depuis une copie, « Modifier la note » ouvre l'écran de correction (motif obligatoire, tracé dans le journal). Les copies notées de « À faire » mènent aussi à « Revoir ».
- Le détail minute par minute reste accessible.

## 0.48 — 26/11/2026
- Pages du parent allégées, selon la maquette validée : chaque page a un rôle et aucun chiffre n'est en double.
  - **Accueil** : ce que fait l'enfant en ce moment, « À faire », la semaine en 2 chiffres, les 3 dernières notes (avec « Revoir »), les cours acquis par matière.
  - **En direct** : maintenant et aujourd'hui seulement (frise de la journée, séances du jour).
  - **Bilan** : matière par matière (notes une par une depuis le 1er septembre, moyenne avec leur nombre, cours acquis, cours à revoir), temps de travail par semaine, puis « Pour aller plus loin » replié : test de positionnement, questionnaire, bilan par l'IA, tous les chiffres détaillés, confidentialité.
- **Passer cette leçon** (élève) : depuis l'accueil ou la leçon, pour n'importe quelle raison, sans aucune sanction (ni points, ni niveau). Le cours suivant est proposé ; le cours passé reste dans « Tous mes cours » et reprend sa place dès que l'élève y revient. Le parent le voit dans l'Activité (« passée pour l'instant »).

## 0.49 — 26/11/2026
- Temps de travail : le délai laisse le temps au brouillon et à la réflexion. Le temps compte tant que la page de travail est visible ; il s'arrête si elle est cachée (autre onglet, fenêtre réduite, écran verrouillé, autre application sur téléphone) ou après 10 minutes sans rien toucher (au lieu de 60 secondes). Réglable par le parent : 5, 10 ou 15 minutes. Pendant une évaluation, aucune fenêtre ne s'ouvre et le chrono de l'évaluation continue.
- Les comparaisons de temps à cheval sur ce changement le disent (note sous les graphiques) et n'affichent plus de flèche.
- « Tu es là ? » n'apparaît plus qu'à ce moment-là, plus au bout de 3 minutes.

## 0.50 — 26/11/2026
- **Révisions espacées**, selon la maquette validée. Une leçon finie est révisée le lendemain, puis à 3, 7, 14, 30 et 60 jours si l'élève a au moins 4 bonnes réponses sur 5. Sinon, retour à 1 jour.
  - Chaque révision pose jusqu'à 5 questions par cours, corrigées tout de suite, prises dans les exercices et les points de contrôle du cours, en commençant par celles revues le moins récemment. Jamais de question de l'évaluation, qui doit rester inconnue.
  - Les leçons déjà finies avant cette version sont programmées à 2 par jour à partir d'aujourd'hui.
  - L'ancienne révision unique (exercices refaits 3 à 30 jours après l'évaluation) est remplacée. La réinitialisation d'un cours efface aussi ses révisions.
  - Au plus 2 cours par jour.
  - L'élève voit « Ta révision du jour » sur son accueil.
  - Le parent voit chaque révision dans le Bilan, avec la règle de calcul, les études sur lesquelles elle repose et ce qui reste une convention. L'Activité a un filtre « Révisions ».
- Dossier scolaire, chiffres précisés :
  - « cours évalués » (au moins une évaluation notée), dont les cours acquis (14/20 ou plus), sur les cours disponibles et sur le programme. Avant, un seul chiffre « acquis / programme » mêlait les cours pas encore publiés.
  - « moyenne des meilleures notes » avec le nombre de cours ;
  - « de travail » avec sa période ;
  - pour le parent, le nombre d'évaluations notées à la place des points de progrès, qui restent visibles pour l'élève.
- Le numéro de version n'est plus visible que pour l'administrateur.
