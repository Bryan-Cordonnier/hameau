# Hameau : journal des changements

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).
Chaque version a sa section ici avant d'être publiée : ce texte devient la Release GitHub.

## [Non publié]

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
