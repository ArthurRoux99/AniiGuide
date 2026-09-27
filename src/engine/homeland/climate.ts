import type { Environment } from '../../data/homeland';
import { COVERAGE, deviceSize, layoutsFor, PLOT_KIND, type Layout, type PlotKind } from './coverage';
import type { Plan, PlanRow } from './optimize';

// Plan des zones climatiques : pour chaque appareil, le placement exact des parcelles couvertes
// (au quart de case près), tiré des placements optimaux précalculés (voir coverage.ts).

export interface PlacedPlot {
  kind: PlotKind;
  facility: string;
  crop: string;
  /** Coin de la parcelle en cases, relatif au coin de l'appareil. */
  x: number;
  y: number;
  size: number;
}

export interface ClimateZone {
  device: string;
  env: Environment;
  /** Côté de l'appareil en cases. */
  size: number;
  plots: PlacedPlot[];
}

export interface ClimateLayout {
  zones: ClimateZone[];
  /** Parcelles couvertes qui n'ont pas trouvé de place (arrondi) : à poser au plus près. */
  overflow: { facility: string; crop: string; count: number }[];
}

const AREA: Record<PlotKind, number> = { farmland: 4, woodland: 16, big: 25 };

export function climateLayout(plan: Pick<Plan, 'climate'>, rows: PlanRow[], whole: Map<PlanRow, number>): ClimateLayout {
  const zones: ClimateZone[] = [];
  const overflow: ClimateLayout['overflow'] = [];
  for (const c of plan.climate) {
    // Parcelles voulues (nombres entiers), par type.
    const demand: Record<PlotKind, { facility: string; crop: string }[]> = { farmland: [], woodland: [], big: [] };
    for (const r of rows.filter((r) => r.covered && r.recipe.environment === c.env)) {
      const kind = PLOT_KIND[r.recipe.facility] ?? 'big';
      for (let i = 0; i < (whole.get(r) ?? 0); i++) demand[kind].push({ facility: r.recipe.facility, crop: r.recipe.output.item });
    }
    const size = deviceSize(c.device);
    const center = size / 2;
    for (let z = 0; z < c.zones; z++) {
      const left = { farmland: demand.farmland.length, woodland: demand.woodland.length, big: demand.big.length };
      if (!left.farmland && !left.woodland && !left.big) break;
      // Le mélange qui place le plus de surface demandée ; à égalité, le plus compact (parcelles
      // utilisées au plus près de l'appareil).
      const dist = (p: { kind: PlotKind; x: number; y: number }) => {
        const h = COVERAGE.sizes[p.kind] / 2;
        return Math.hypot(p.x + h - center, p.y + h - center);
      };
      const pick = (l: Layout) => {
        const used = (['big', 'woodland', 'farmland'] as PlotKind[]).flatMap((k) =>
          l.plots
            .filter((p) => p.kind === k)
            .sort((x, y) => dist(x) - dist(y))
            .slice(0, left[k]),
        );
        const area = used.reduce((s, p) => s + AREA[p.kind], 0);
        const spread = used.reduce((s, p) => s + dist(p) * AREA[p.kind], 0);
        return { used, area, spread };
      };
      const best = [greedy(size, left), ...layoutsFor(c.device).map(pick)].reduce((x, y) =>
        y.area > x.area || (y.area === x.area && y.spread < x.spread) ? y : x,
      );
      const plots: PlacedPlot[] = best.used.map((spot) => ({ ...spot, ...demand[spot.kind].shift()!, size: COVERAGE.sizes[spot.kind] }));
      zones.push({ device: c.device, env: c.env, size, plots });
    }
    for (const kind of ['farmland', 'woodland', 'big'] as PlotKind[])
      for (const d of demand[kind]) {
        const hit = overflow.find((o) => o.facility === d.facility && o.crop === d.crop);
        if (hit) hit.count++;
        else overflow.push({ ...d, count: 1 });
      }
  }
  return { zones, overflow };
}

/**
 * Placement glouton au plus près de l'appareil (grille à la demi-case) : idéal quand la zone n'est
 * pas pleine ; pour une zone pleine, les placements précalculés font mieux.
 */
function greedy(size: number, want: Record<PlotKind, number>) {
  const R = COVERAGE.radius, c = size / 2;
  const over = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 1e-6 && a1 > b0 + 1e-6;
  const used: { kind: PlotKind; x: number; y: number }[] = [];
  const taken: [number, number, number][] = [];
  for (const kind of ['big', 'woodland', 'farmland'] as PlotKind[]) {
    const s = COVERAGE.sizes[kind];
    const spots: { x: number; y: number; d: number }[] = [];
    for (let x = c - R - s + 0.5; x < c + R; x += 0.5)
      for (let y = c - R - s + 0.5; y < c + R; y += 0.5) {
        if (over(x, x + s, 0, size) && over(y, y + s, 0, size)) continue;
        spots.push({ x, y, d: Math.hypot(x + s / 2 - c, y + s / 2 - c) });
      }
    spots.sort((a, b) => a.d - b.d);
    let n = 0;
    for (const p of spots) {
      if (n >= want[kind]) break;
      if (taken.some(([tx, ty, ts]) => over(p.x, p.x + s, tx, tx + ts) && over(p.y, p.y + s, ty, ty + ts))) continue;
      taken.push([p.x, p.y, s]);
      used.push({ kind, x: p.x, y: p.y });
      n++;
    }
  }
  const area = used.reduce((s, p) => s + AREA[p.kind], 0);
  const spread = used.reduce((s, p) => s + Math.hypot(p.x + COVERAGE.sizes[p.kind] / 2 - c, p.y + COVERAGE.sizes[p.kind] / 2 - c) * AREA[p.kind], 0);
  return { used, area, spread };
}

/** Vérifie un placement : parcelles dans la zone, sans chevauchement ni empiètement sur l'appareil. */
export function checkZone(z: ClimateZone): string[] {
  const errors: string[] = [];
  const R = COVERAGE.radius, c = z.size / 2;
  const over = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 1e-6 && a1 > b0 + 1e-6;
  z.plots.forEach((p, i) => {
    if (!(over(p.x, p.x + p.size, c - R, c + R) && over(p.y, p.y + p.size, c - R, c + R))) errors.push(`parcelle ${i} hors zone`);
    if (over(p.x, p.x + p.size, 0, z.size) && over(p.y, p.y + p.size, 0, z.size)) errors.push(`parcelle ${i} sur l'appareil`);
    z.plots.slice(i + 1).forEach((q, j) => {
      if (over(p.x, p.x + p.size, q.x, q.x + q.size) && over(p.y, p.y + p.size, q.y, q.y + q.size)) errors.push(`parcelles ${i} et ${i + 1 + j} se chevauchent`);
    });
  });
  return errors;
}
