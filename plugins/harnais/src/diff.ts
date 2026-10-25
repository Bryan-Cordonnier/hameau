// Différences mot à mot entre deux versions d'un document (plus longue sous-suite commune) : sert à montrer, animées,
// les modifications qu'un agent vient de faire dans le cahier d'un chantier.

export type Morceau = { genre: "garde" | "retire" | "ajoute"; texte: string };

/** Découpe en mots en gardant les espaces et retours à la ligne attachés, pour recoller le texte à l'identique. */
const mots = (t: string): string[] => t.match(/\s+|[^\s]+/g) ?? [];

/** Au-delà, on ne calcule pas finement (trop long) : tout l'ancien est retiré, tout le nouveau ajouté. */
const MAX = 4000;

export function difference(avant: string, apres: string): Morceau[] {
  const a = mots(avant);
  const b = mots(apres);
  if (a.length * b.length > MAX * MAX / 4 || a.length > MAX || b.length > MAX) {
    return [...(avant ? [{ genre: "retire" as const, texte: avant }] : []), ...(apres ? [{ genre: "ajoute" as const, texte: apres }] : [])];
  }
  // table des longueurs de la plus longue sous-suite commune, en partant de la fin
  const l: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) l[i]![j] = a[i] === b[j] ? l[i + 1]![j + 1]! + 1 : Math.max(l[i + 1]![j]!, l[i]![j + 1]!);
  const sortie: Morceau[] = [];
  const pousser = (genre: Morceau["genre"], texte: string) => {
    const dernier = sortie[sortie.length - 1];
    if (dernier && dernier.genre === genre) dernier.texte += texte;
    else sortie.push({ genre, texte });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pousser("garde", a[i]!);
      i++;
      j++;
    } else if (l[i + 1]![j]! >= l[i]![j + 1]!) pousser("retire", a[i++]!);
    else pousser("ajoute", b[j++]!);
  }
  while (i < a.length) pousser("retire", a[i++]!);
  while (j < b.length) pousser("ajoute", b[j++]!);
  return sortie;
}
