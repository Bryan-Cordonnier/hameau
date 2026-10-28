# AGL — Fonctionnalité 2 : la gestion des agents

Statut : **validé par Bryan (« C'est bon ») le 27/10/2026.**

## Besoin
Aujourd'hui Bryan ne parle qu'à Max, sur Element, comme à un secrétaire. Il veut passer à une gestion d'agents : créer un agent, lui attribuer des rôles et des permissions.

## Existant (27/10/2026)
- Le harnais fait tourner des « postes » décrits dans `/srv/cerveau/harnais/postes.json` : nom, jeton du cerveau (donc ses droits), adresse du modèle, consigne, nombre d'étapes, heures de silence, messagerie Matrix, `automatique`.
- Le cerveau donne à chaque jeton des droits sur la bibliothèque et les commandes, et a déjà une commande `agent_create`.
- Max : seul poste, sur Claude Haiku 5.5, discussion seule depuis le 27/10.

## Décisions
- Agents prévus : Max (secrétaire, assistant du quotidien, chef d'équipe), plus tard un « gestionnaire » de Retux qui tourne 24 h/24 (nouvelles commandes…), un comptable, et des agents de développement externes (comme Claude Code, abonnement à part).
- Bryan ne parle qu'à Max. Max distribue le travail ; les autres agents ne lui répondent pas, ils servent à séparer proprement les tâches.
- **Accès externe** : pour une IA d'un abonnement externe, on crée l'accès dans l'AGL, qui génère une clé ; on donne la clé à l'agent. Chaque accès se gère à part (droits, tâches). Claude Code apparaît dans la liste comme les autres.
- **Rôle = un métier réutilisable** (secrétaire, comptable, développeur…). On peut changer l'IA qui tient un rôle (passer à un modèle local un jour) sans refaire le rôle. Un agent peut avoir plusieurs rôles.
- **Permissions** : branches du cerveau, mais aussi services extérieurs (GitHub, Infomaniak, etc.).
- Fiche d'agent : nom, émoji ou avatar, rôles, moteur, permissions, horaires de silence ; onglet Activité (ce qu'il a lu, écrit, fait, et coûté).
- Moteur interchangeable : modèle local, API, ou accès externe.
- Structure : **Rôle** (métier : consigne, permissions, horaires de silence, budget) / **Moteur** (l'IA qui tient le rôle : modèle local, API, accès externe) / **Agent** (nom + émoji ou avatar = un ou plusieurs rôles tenus par un moteur). Changer de moteur ne touche ni au rôle ni à ses permissions.
- Les permissions appartiennent au rôle ; un agent à plusieurs rôles cumule leurs permissions.
- Clé d'accès externe : générée dans l'AGL, montrée une seule fois, révocable d'un clic, expiration facultative.
- Tout est journalisé : on retrouve qui a fait quoi.
- Services extérieurs (GitHub, Infomaniak…) : leurs clés restent dans un coffre du cerveau ; l'agent n'a que des droits d'actions, jamais la clé.
- Permission « donner une tâche à un autre agent » (pour Max, chef d'équipe).
- Budget par rôle (au-delà, l'agent s'arrête et prévient Bryan). Le gestionnaire Retux 24 h/24 sera détaillé à sa création.
- Présentation : liste qui défile de cartes rectangulaires horizontales, empilées. Sur la carte : à gauche le nom, en dessous le rôle, en dessous le moteur ; au milieu à droite l'état, en dessous la dernière activité ; tout à droite l'avatar.
- **Révision :** un agent est un poste avec son rôle ; le rôle se crée avec l'agent et évolue avec lui (ex. le gestionnaire Retux gère d'abord les mails, puis aussi le SAV). Pas de liste de rôles à part. Changer de moteur garde le rôle et les permissions.
- Création : « + Nouvel agent » → nom et émoji → rôle → moteur ; pour un accès externe, la clé s'affiche à la fin.
- Interrupteur pause / reprise sur chaque carte, et un bouton « Tout arrêter ».
- Un seul rôle par agent, qui s'enrichit avec le temps ; pas de duplication d'agent.
- Historique des versions du rôle (consigne et permissions) : voir ce qui a changé, revenir en arrière.
- Le coût de l'agent est dans sa fiche (onglet Activité), pas sur la carte.
- Deux permissions de délégation : « donner du travail à tous les agents » (Max l'a) et « donner du travail à certains agents » (liste choisie).

