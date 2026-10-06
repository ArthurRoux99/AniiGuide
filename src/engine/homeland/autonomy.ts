import { HOMELAND } from '../../data/homeland';
import type { Plan, Setup } from './optimize';

export interface Autonomy {
  facility: string;
  item: string;
  /** Stock de l'installation à son niveau (en objets). */
  stock: number;
  /** Objets produits par heure par un exemplaire occupé à plein temps. */
  perHour: number;
  /** Heures avant que le stock soit plein et que l'installation s'arrête, faute de transporteur. */
  hours: number;
}

/**
 * « Quand revenir ? » : une installation garde sa production jusqu'à son stock maximal, puis
 * s'arrête en attendant qu'un transporteur la vide vers l'Entrepôt. Pour chaque production du
 * plan, le temps avant arrêt si personne ne passe la vider (du plus court au plus long).
 */
export function autonomy(plan: Plan, setup: Setup): Autonomy[] {
  const out: Autonomy[] = [];
  for (const r of plan.rows) {
    const f = r.recipe.facility;
    const level = setup.facilities[f]?.level ?? 0;
    const stock = HOMELAND.levels[f]?.[level - 1]?.stock;
    if (!stock || r.units < 1e-4) continue;
    const perHour = r.outputPerHour / r.units;
    if (perHour <= 0) continue;
    // Plusieurs lignes pour une même recette (niveaux d'Aniimo) : on garde la plus rapide.
    const prev = out.find((a) => a.facility === f && a.item === r.recipe.output.item);
    if (prev) {
      if (perHour > prev.perHour) Object.assign(prev, { perHour, hours: stock / perHour });
      continue;
    }
    out.push({ facility: f, item: r.recipe.output.item, stock, perHour, hours: stock / perHour });
  }
  return out.sort((a, b) => a.hours - b.hours);
}
