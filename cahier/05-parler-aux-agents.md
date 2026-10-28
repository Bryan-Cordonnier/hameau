# AGL — Fonctionnalité 5 : parler aux agents (le harnais)

Statut : **validé par Bryan le 28/10/2026.**

## Besoin
Avoir dans l'AGL un harnais pour utiliser ses agents IA en dehors des abonnements : discuter normalement, coder avec, comme Claude Desktop, avec des fonctionnalités en plus ou en moins.

## Décisions
- Pas un outil pour coder (pas avec des modèles locaux ou des API payantes) ; c'est l'**agentique** qui compte.
- **Max reste l'assistant personnel** et doit être distingué des autres agents ; on peut lui parler dans l'AGL, mais il n'est pas un agent comme les autres.
- On peut **discuter avec n'importe quel agent spécialisé** (ex. l'agent Retux pour le logo, un agent d'études de marché), chacun avec **sa propre mémoire**. On itère avec lui (comment faire l'étude, sa durée…), puis **il crée lui-même la tâche**.
- **Conversations à plusieurs agents** (fonctionnalité rare mais unique) : Bryan + 2 agents ou plus dans la même discussion, pour avoir leurs avis (ex. agent du site et agent de l'ERP sur le lien entre les deux).
- La conversation avec Max dans l'AGL est **la même que sur Element, synchronisée**.
- Le **cerveau est dissocié des agents** (la mémoire d'un agent n'est pas dans le cerveau).
- Une conversation ne mène pas forcément à une tâche. L'agent a des **lots de commandes** pour agir : lot AGL (ajouter, modifier une tâche… tout, avec les permissions), lot Quotidien, etc. Des commandes faites pour ça, pas de données écrites « à la main ». Exception : le cerveau reste des dossiers et des fichiers lisibles en dehors de l'AGL.
- **Commandes d'interface dans la conversation** : l'agent peut ouvrir un menu de questions (Bryan répond ou choisit une proposition) et un menu d'approbation avec boutons, directement dans la discussion.
- **Trois modes** : manuel (Bryan approuve tout), semi-automatique (approbation pour les ajouts et les actions importantes ou sensibles), automatique.
- **Conversations à plusieurs : tour par tour.** Bryan commence en général, puis la parole tourne ; à son tour, il peut cliquer « Passer mon tour » et les agents se répondent entre eux.
- Accès au PC : deux modes, dossiers choisis ou tout.
- Mémoire d'un agent : un carnet propre à l'agent, dans l'AGL (ce qu'il a appris, ses méthodes, les résumés de ses conversations), visible et corrigeable dans sa fiche.
- Barre de saisie : « + » tout à gauche (joindre des fichiers, donner des accès…), micro tout à droite. En dessous, une rangée de petits blocs : à gauche le **mode** de la conversation, puis la jauge du **contexte** utilisé, puis le **prix** (si API payante). Le mode appartient à la conversation, pas à l'agent.
- Semi-automatique : approbation pour créer ou supprimer, envoyer à l'extérieur, lancer une commande sur le serveur, écrire hors des dossiers autorisés ; le reste sans demander. L'argent est interdit dans tous les modes.
- Tour par tour sans limite : Bryan passe son tour quand il veut que les agents discutent ; quand ils ont conclu, il arrête de passer son tour.
- Lots de commandes du départ : AGL (tâches, tableaux, automatisations), Quotidien, cerveau (fichiers), mails (lire, brouillons), PC (fichiers, commandes), serveur (SSH), recherche internet.
- **Travail dans l'instant** : un agent (ex. Max sur Haiku) peut avoir accès au PC, au serveur et au cerveau pour faire une tâche tout de suite, au lieu de la planifier.
- « Passer mon tour » : chaque agent parle une fois, puis la parole revient à Bryan ; il repasse son tour pour qu'ils continuent.
- Liste des conversations à gauche : Max épinglé en haut, puis les conversations avec un agent (récentes d'abord), puis les conversations à plusieurs (émojis des agents). « + Nouvelle conversation » : choisir un ou plusieurs agents.
- Micro : la voix est transcrite en local dans le champ ; Bryan relit avant d'envoyer.
- Menu « + » : joindre un fichier ou une image, donner accès à un dossier du PC pour la conversation, ajouter un agent (la conversation devient à plusieurs).
