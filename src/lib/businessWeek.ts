// Semaine ouvrée de l'entreprise : lundi-samedi, fermé le dimanche (§7.2/§7.8).
// Toutes les bornes "to" sont exclusives (début du jour suivant), pour des
// comparaisons Prisma en `gte`/`lt` sans problème d'arrondi de fin de journée.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Lundi de la semaine contenant `d` (dimanche compte comme fin de la semaine précédente). */
export function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(d), diffToMonday);
}

/**
 * Plage [lundi, dimanche) pour la semaine ouvrée lundi-samedi contenant `d`.
 * `to` est le début du dimanche (exclusif) : lundi..samedi = 6 jours, pas 7 —
 * une erreur ici inclurait le dimanche (fermé) dans la semaine ouvrée.
 */
export function businessWeekRange(d: Date): { from: Date; to: Date } {
  const monday = mondayOf(d);
  return { from: monday, to: addDays(monday, 6) };
}

/** Lundi de la semaine suivante (utile pour la navigation "semaine suivante"). */
export function nextMonday(d: Date): Date {
  return addDays(mondayOf(d), 7);
}

export function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  return new Date(y, m - 1, day);
}
