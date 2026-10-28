# AGL — Fonctionnalité 4 : les automatisations

Statut : **validé par Bryan le 28/10/2026.**

## Contexte
Le 27/10, Bryan a tout coupé : tâches dues de Max, rapport du soir, tâche planifiée Claude (5 fois par jour). Trop de choses tournaient seules, sans vue d'ensemble. Idées du 26/10 : « réflexes », réservés à Max et aux API, créés avec Max ; pas d'éditeur à la n8n.

## Décisions
- Pour l'instant, deux automatisations seulement :
  - **Point du soir** de Max : un seul rapport court ; en 5 minutes de lecture au maximum, Bryan sait où on en est (avancement en quelques mots, blocages, infos importantes). Plus de rapports à toute heure.
  - **Tri des mails** une fois par jour, avant 18 h. Le tri doit être visible : on voit ce qui a été trié et pourquoi.
- Une automatisation crée une carte de tâche. Elle ne crée la suivante que quand la précédente est finie (pas 365 cartes d'avance). La carte terminée reste dans Terminé jusqu'à minuit, puis la suivante est créée le lendemain.
- Un tableau dédié **« Automatisations », tout en haut**, géré par l'AGL ; les autres tableaux, c'est Bryan qui les gère.
- Deux sortes de déclencheurs :
  - **Temporel**, réglable finement : toutes les N minutes ou heures, tous les jours, certains jours de la semaine, etc. Il ne se déclenche jamais plus que ce qui est réglé.
  - **Événement** (à ne pas bâcler) : un programme sans IA écoute un connecteur du cerveau (ex. la boîte mail) et réveille l'IA seulement quand l'événement se produit. Jamais une consigne du genre « surveille si je reçois un mail de X » donnée à l'IA. Chaque connecteur propose son propre catalogue de types d'événements. Création : on choisit le type d'événement, on le règle (ex. « mail reçu dans bryan.cordonnier@ik.me de la part de xxx »), puis on écrit la consigne que l'IA reçoit quand il se produit.
- Réglages d'un événement : filtres combinables en **ET et OU**. Pour « mail reçu » : boîte, expéditeur (adresse ou domaine), objet contient, texte contient, pièce jointe oui/non (d'autres idées bienvenues).
- La carte créée contient l'événement lui-même (pour un mail : expéditeur, objet, date, texte).
- **Emboîter l'événement** (oui/non) : oui = l'IA ne reçoit que le contenu de l'événement, sans autre accès (ex. « résume-moi ce mail ») ; non = elle est libre d'utiliser ses accès (ex. « si c'est une offre, cherche sur internet… »).
- Plusieurs événements pendant qu'une carte est en cours : une seule carte qui les regroupe.
- Un déclenchement reporté n'est jamais perdu : il attend et part au début de la période suivante.
- Historique des déclenchements (lancé, reporté, en attente de crédits) dans la fiche de l'automatisation, discret.
- Connecteurs d'événements : boîte mail, **serveur** (surveillance), plus tard le **site Retux** (commandes). Pas Quotidien (il ne reçoit que des infos saisies à la main), pas GitHub (un agent signale lui-même un test raté).
- Événements du serveur proposés : disque malade (SMART en échec ou secteurs défectueux en hausse), disque ou volume des VM presque plein, chauffe, mémoire saturée, serveur injoignable, redémarrage imprévu, service arrêté, sauvegarde ratée, connexion suspecte.
- « Serveur injoignable » : guetteur extérieur = **Healthchecks.io, déjà en place** (le serveur lui fait signe ; s'il se tait, c'est Healthchecks qui alerte).
- Idées retenues pour « mail reçu » : expéditeur jamais vu, réponse à un mail envoyé par Bryan, plage horaire.
- Les alertes du serveur passeront toutes par là, et c'est Max qui prévient (pas de notification téléphone à part). Coupé dès le 28/10/2026 : notifications Proxmox (matcher par défaut désactivé), mails SMART (smartd `-m <nomailer>`, ancien fichier `/etc/smartd.conf.avant-agl`), alertes ntfy du serveur (`notifier-echec` neutralisé, ancien `notifier-echec.avant-agl`) et notification ntfy d'Uptime Kuma (désactivée).
- Présentation : liste de cartes horizontales empilées (nom, déclencheur, tableau et agent, prochaine exécution, dernier résultat, interrupteur).
- Plus de crédits d'API (le quota est fixé chez le fournisseur, ex. Claude Haiku) : pas d'arrêt brut ; l'AGL et les agents comprennent qu'ils sont arrêtés faute de crédits, et c'est affiché comme tel.
- Pas de garde-fou imposé. Garde-fou facultatif réglé à la main, deux réglages : un nombre d'**appels** et une **durée** (ex. 5 appels par heure, par jour, par semaine…). Au-delà, le déclenchement est reporté à la période suivante.
- « Tout arrêter » coupe aussi les automatisations.
- Création : par Bryan dans l'AGL (nom, déclencheur, tableau, consigne), ou par Max sous forme de brouillon que Bryan valide dans l'AGL.
