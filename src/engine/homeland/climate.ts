import type { Environment } from '../../data/homeland';
import type { Plan, PlanRow } from './optimize';

// Plan des zones climatiques : range les cultures couvertes du plan dans les zones des appareils.
//
// Une zone fait 9×9 cases (à confirmer en jeu). On la découpe en 4 quarts de 4×4 : un quart
// reçoit une Pépinière (4×4) ou 4 Fermes (2×2). C'est la même capacité que celle de l'optimiseur
// (4 Pépinières ou 16 Fermes par zone, mélange au prorata), à l'arrondi près.

export type Quarter = { kind: 'woodland'; crop: string } | { kind: 'farmland'; crops: (string | null)[] } | null;

export interface ClimateZone {
  device: string;
  env: Environment;
  quarters: Quarter[];
}

export interface ClimateLayout {
  zones: ClimateZone[];
  /** Cultures qui ne tiennent pas dans les zones (l'arrondi des parcelles) : à poser hors zone. */
  overflow: { facility: string; crop: string; count: number }[];
}

export function climateLayout(plan: Pick<Plan, 'climate'>, rows: PlanRow[], whole: Map<PlanRow, number>): ClimateLayout {
  const zones: ClimateZone[] = [];
  const overflow: ClimateLayout['overflow'] = [];
  for (const c of plan.climate) {
    const mine = rows.filter((r) => r.covered && r.recipe.environment === c.env);
    const woods = mine.filter((r) => r.recipe.facility === 'woodland').flatMap((r) => Array<string>(whole.get(r) ?? 0).fill(r.recipe.output.item));
    const farms = mine.filter((r) => r.recipe.facility === 'farmland').flatMap((r) => Array<string>(whole.get(r) ?? 0).fill(r.recipe.output.item));
    const own = Array.from({ length: c.zones }, (): ClimateZone => ({ device: c.device, env: c.env, quarters: [null, null, null, null] }));
    const free = () => own.flatMap((z) => z.quarters.map((q, i) => ({ z, i, q }))).filter((x) => x.q === null);

    // Pépinières d'abord (elles prennent un quart entier), puis les Fermes par quatre.
    for (const crop of woods) {
      const slot = free()[0];
      if (slot) slot.z.quarters[slot.i] = { kind: 'woodland', crop };
      else add(overflow, 'woodland', crop);
    }
    for (let k = 0; k < farms.length; k += 4) {
      const group = farms.slice(k, k + 4);
      const slot = free()[0];
      if (slot) slot.z.quarters[slot.i] = { kind: 'farmland', crops: [...group, ...Array(4 - group.length).fill(null)] };
      else for (const crop of group) add(overflow, 'farmland', crop);
    }
    zones.push(...own);
  }
  return { zones, overflow };
}

function add(list: ClimateLayout['overflow'], facility: string, crop: string) {
  const hit = list.find((o) => o.facility === facility && o.crop === crop);
  if (hit) hit.count++;
  else list.push({ facility, crop, count: 1 });
}
