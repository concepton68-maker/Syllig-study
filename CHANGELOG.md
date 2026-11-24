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
