# AGL — Fonctionnalité 7 : les projets

Statut : **validé par Bryan le 28/10/2026.** (Carte blanche donnée par Bryan.)

## Besoin
Le projet relie tout : ses informations (cerveau), ses tâches (tableaux), ses agents dédiés, ses automatisations, ses conversations. On voit d'un coup d'œil ce qui est actif, en pause, terminé.

## Autres idées passées en revue (28/10)
- « À moi de jouer » (tout ce qui attend Bryan) : mis de côté pour l'instant.
- Connecteurs et coffre : oui, mais dans les paramètres.
- Recherche globale (Ctrl+K) : oui.
- Budget global : non pour l'instant (abonnement Claude externe, 5 € de test sur Haiku).
- Journal des décisions : non, l'état des projets suffit.

## Décisions
- Un projet relie : sa branche du cerveau (créée automatiquement à la création du projet, même couleur et émoji), son tableau de tâches (créé automatiquement, d'autres possibles), ses agents dédiés (accès par défaut à sa branche et à ses tableaux), ses automatisations, ses conversations.
- État : actif, en pause (automatisations arrêtées, cartes non prises, agents dédiés en pause, branche grisée sur la carte ; reprise = tout repart), terminé, abandonné (archivés en bas).
- Page Projets : cartes horizontales empilées (émoji, nom, état, objectif, prochain jalon, avancement), glissées pour l'ordre de priorité.
- Fiche : vue d'ensemble (objectif, jalons, avancement, activité), règles du projet (consignes communes à ses agents), onglets Tâches, Agents, Cerveau, Conversations.
- Un agent qui travaille sur une tâche du projet reçoit automatiquement la fiche du projet.
- Pas de « jalons » : chaque projet a une **road map éditable**, la liste des objectifs à atteindre.
- Objectif de la road map : titre, date visée, état (à venir, en cours, atteint, abandonné).
- Présentation : **liste horizontale** qui défile, centrée par défaut sur le prochain objectif ; on fait défiler vers la gauche pour revoir les objectifs atteints.
- On rattache des cartes de tâches à un objectif : son avancement se calcule tout seul, et la carte du projet montre l'objectif en cours.
- La road map est modifiée par Bryan et par les agents qui y sont autorisés (permission).
- Boîte à idées : oui, mais **invisible** (pas de page, pas d'onglet). C'est juste un espace dans le cerveau, dans la branche du projet. Bryan dit « idée : … » à Max, qui la range ; elle ressort quand on modifie la road map, quand un agent discute du projet, ou quand Bryan la demande.
- Sous-projets (ex. Retux > Site, ERP) : chacun son état ; mettre le parent en pause met tout en pause.
