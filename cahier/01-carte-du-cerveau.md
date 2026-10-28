# AGL — Fonctionnalité 1 : la carte du cerveau

Statut : **validé par Bryan (« C'est bon ») le 27/10/2026.**

## Besoin
Voir le cerveau (ajuster des informations, comprendre ce que les agents savent de Bryan, et pour le plaisir) et l'éditer en direct. Le cerveau doit être un éditeur qui organise tout seul : ce qui est clair à l'écran est aussi clair pour une IA qui le parcourt.

## Hiérarchie (un seul lien : parent → enfant)
| Étage | Exemple | Icône | Fichiers |
|---|---|---|---|
| Cerveau (fixe, centre, ne s'ouvre pas) | Cerveau | logo AGL + « Cerveau » | `sommaire-cerveau.md` |
| Pôle : une facette de la vie | Retux, Moi, Max | émoji ou logo (même taille affichée) | `retux/sommaire-retux.md` |
| Sujet : une partie d'un pôle | Site, ERP, appli de Max | émoji au choix (📁 par défaut) | `retux/site/sommaire-site.md` |
| Section (peut contenir des sections) | Code, Maquettes, Historique | émoji au choix (📁 par défaut) | `…/code/sommaire-code.md` |
| Neurone : une fiche d'information | | 📄 toujours | `nom-de-la-fiche.md` |
| Souvenirs : 1 bloc max par dossier, sans aperçu ; clic = galerie | logos, images | 🖼️ | `…/souvenirs/` ; description d'un fichier = son titre |

- Les blocs se distinguent nettement par leur taille selon l'étage.
- Pas de liens « voir aussi » : une information partagée va dans un dossier à part au même niveau (ex. « Lien site/erp » à côté de Site et ERP), parent d'aucun des deux.
- Le cerveau contient des informations, jamais le code (la section « Code » dit où est le code, les technos, les règles, les pièges).
- Couleurs héritées : une couleur posée sur un bloc colore toute sa branche, jusqu'à ce qu'un bloc plus bas en pose une autre.
- Les sommaires sont écrits par la machine (description + liste des enfants) et tenus à jour **dans le cerveau, côté serveur** : ce qu'écrivent Max et Claude se range aussi tout seul.

## Édition
- La carte est l'écran principal ; un panneau latéral droit (arbre façon explorateur) s'ouvre et se ferme.
- Clic droit → Nouveau → l'étage voulu ; on demande le nom, la description (et le texte pour un neurone).
- Créé sur la carte : on le relie à la main ; créé dans l'arbre : sa place est là où on le range.
- Chaque bloc s'ouvre pour lire et modifier ce qui y est écrit.

## Reprise de l'existant
Toute la bibliothèque (722 fiches au 27/10/2026, Retux éparpillé dans travail/, projets/site, projets/erp, projets/retux-commun) est rangée une fois au départ dans cette hiérarchie, selon un plan validé par Bryan.

## Édition sur la carte
- Bloc créé sur la carte et pas encore relié : il va dans un dossier spécial « Pas organisés », au niveau des pôles (`pas-organises/`).
- Souris dans le bloc = le déplacer ; clic sur sa bordure = tirer un fil vers le parent.
- Fils tracés automatiquement (droits ou courbes) : un fil ne passe jamais par-dessus un bloc ; des fils qui se croisent, c'est permis.
- Déplacer un bloc rangé (changer de parent) : tout son contenu suit, les sommaires se réorganisent tout seuls.

- Sections dans des sections sans limite de profondeur.
- Un bloc placé à la main garde sa place (enregistrée) ; un nouveau bloc se place tout seul autour de son parent ; bouton « Ranger la carte ».
- Tout est affiché d'emblée (pas de dépliage) ; molette pour zoomer ; barre de recherche qui centre sur le bloc trouvé.

- Tailles : Cerveau > Pôle > Sujet > Section ; toutes les sections ont la même taille, quelle que soit leur profondeur.
- Affichage selon le zoom : de loin, les neurones sont des points de couleur et seuls les noms des pôles et sujets s'affichent ; en zoomant, apparaissent les noms des sections puis des neurones.
- Suppression : le bloc et tout son contenu vont dans un dossier « Supprimés » insupprimable, qui garde tout et n'est pas affiché sur la carte. Invisible pour les agents (Max, Claude) ; seul Bryan y va pour restaurer, supprimer définitivement un élément à la main, ou tout vider (bouton avec confirmation).
