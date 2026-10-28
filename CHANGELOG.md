# Hameau : journal des changements

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).
Chaque version a sa section ici avant d'être publiée : ce texte devient la Release GitHub.

## [Non publié]

## [0.3.0] — 2026-10-28

L'AGL refait de A à Z d'après le cahier des fonctionnalités (`cahier/`), validé fonctionnalité par fonctionnalité.

### Ajouté

- **Carte du cerveau** : le cerveau au centre, puis pôles, sujets et sections (sans limite de profondeur), grappes de neurones et blocs Souvenirs ; tailles par étage, couleurs héritées, affichage selon le zoom. Souris dans un bloc = le déplacer, clic sur sa bordure = tirer un fil vers son nouveau parent (fils qui contournent les blocs) ; clic droit = Nouveau ; « Ranger la carte », recherche, arbre en panneau latéral, « Supprimés » (invisible pour les agents, Tout vider avec confirmation). Les sommaires `sommaire-<nom>.md` sont écrits par le cerveau à chaque changement.
- **Agents** : cartes horizontales (nom, rôle, moteur ; état, dernière activité ; avatar), pause / reprise, « Tout arrêter » ; fiche avec rôle versionné, permissions (cerveau, actions, services branchés), moteur (API Claude, modèle local, accès externe avec clé montrée une seule fois, révocable), carnet de l'agent ; création en 3 étapes.
- **Tâches** : tableaux empilés façon Trello (Automatisations tout en haut), accès par agents, colonnes À faire / En cours / Terminé / Bloqué, cartes rangées en hauteur par priorité, carte agrandie (étapes, rapport), réponse à une carte bloquée qui crée la suite « #2 », archives après 7 jours.
- **Automatisations** : à l'heure (minutes, heures, jours) ou sur un événement (boîte mail, serveur ; site Retux plus tard), filtres ET / OU, événement emboîté, garde-fou appels / durée, créées éteintes, historique discret.
- **Conversations** : Max épinglé (la même conversation que sur Element), conversations avec un agent ou à plusieurs (tour par tour, « Passer mon tour »), menus de questions et approbations avec boutons, modes manuel / semi-auto / auto, micro (transcription locale), jauge de contexte et prix.
- **Accueil** : une grille de blocs en pixel art animés, Max en grand.
- **Projets** : cartes empilées classées par priorité, états (actif, en pause, terminé, abandonné) qui se propagent, sous-projets, road map horizontale, règles du projet, agents dédiés, branche du cerveau et tableau créés tout seuls.
- **Recherche partout** (Ctrl+K) et **Paramètres AGL** (travail des cartes, Tout arrêter, connecteurs dont la clé va au coffre du cerveau).

### Retiré

- L'île, le tableau, les chantiers, le courrier, le petit mot et les réflexes de la 0.2.

## [0.2.0] — 2026-10-26

### Modifié

- **Hameau devient AGL** (Agents Link) : nouveau logo (cerveau mi-binaire mi-circuit), thème sobre presque monochrome, icônes en émojis.
- **Accueil** : un bureau fixe en 2D où l'on voit les agents travailler ; au survol, leur tâche en cours, leur profil, leurs tâches et un champ pour leur écrire.
- **Tâches** : tableau en lignes (groupes et projets en arbre, réservables à un agent) et colonnes (À faire, En cours, Bloqué, Terminé), sous-tâches, échéances, « me prévenir à la fin » et « rapport dans AGL » ; les chantiers y apparaissent aussi.

### Ajouté

- **Réflexes** : les tâches qui reviennent, créées en les décrivant à Max ou à la main.
- **Équipe** : moteur de chaque agent (local, Claude Opus, Sonnet ou Haiku), configurations de modèles locaux, nouvel agent, tutoriel « Connecter Claude ».
- **Message rapide à Max** en bas de la colonne.

## [0.1.0] — 2026-10-25

### Ajouté

- **Accueil : le bureau des IA** : un open space vu de haut où Max (pion violet en costard) et Claude rejouent ce que note le journal du cerveau (mails, fiches, chantiers, tâches). Survol pour les noms, clic sur une zone pour sa fiche, thème clair ou sombre.
- **Tableau, Chantiers, Courrier, Petit mot** : les tâches des agents, les chantiers avec leur document et leur discussion, les rapports avec leurs questions, un mot pour Max.
- **Équipe** : les agents, leurs permissions, la personnalité de Max, ses heures de silence et les réglages du modèle local (contexte, conversations en parallèle, température, réflexion, cache), modifiables.
- **Cerveau** : la carte de la bibliothèque, pour tout voir et réorganiser.
