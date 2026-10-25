// Dates lisibles : « il y a 5 min », « hier 20:14 », « lun. 26 oct. ».

export function ilYa(secondes: number, maintenant = Date.now() / 1000): string {
  const d = Math.max(0, Math.round(maintenant - secondes));
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  const date = new Date(secondes * 1000);
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jour = (x: Date) => x.toDateString();
  const auj = new Date(maintenant * 1000);
  const hier = new Date((maintenant - 86400) * 1000);
  if (jour(date) === jour(auj)) return `aujourd'hui ${heure}`;
  if (jour(date) === jour(hier)) return `hier ${heure}`;
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
