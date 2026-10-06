import type { ClimateLayout } from './climate';
import { layOutHomeland, type LayoutResult, type Piece, type Rect } from './layout.js';
import type { PlanRow } from './optimize';

// Plan complet du logis : chaque installation du plan posée sur le terrain ouvert, autour de
// l'Entrepôt, les plus fréquentées au plus près (les transporteurs y rapportent chaque lot).
// Tailles des installations et terrain relevés en jeu par Aniimax (MIT, web/facility-config.js).

/** Emprise au sol (largeur × profondeur, en cases). */
export const FOOTPRINT: Record<string, [number, number]> = {
  farmland: [2, 2],
  woodland: [4, 4],
  mine: [5, 5],
  well: [2, 2],
  'tidewhisper-sandcastle': [5, 5],
  'dewy-house': [2, 2],
  'nimbus-bed': [5, 5],
  'starfall-hammock': [5, 5],
  'floral-windmill': [5, 5],
  'heat-furnace': [1, 1],
  'cooling-unit': [2, 2],
  sunlamp: [1, 1],
  'carousel-mill': [5.5, 5.5],
  'crafting-table': [4, 4],
  'claw-game-cooker': [3.5, 3.5],
  'simmering-pot': [1.5, 1.5],
  'phonolfactory-table': [3.5, 3.5],
  'bouncy-brew-keg': [3, 3],
  'blazing-stove': [2.5, 1.75],
  'pickling-jar': [2.5, 2],
  'jukebox-dryer': [2.5, 2.5],
  'joy-wheel-loom': [4, 4],
  'woodworking-bench': [2, 1.5],
  'chimney-kiln': [5.5, 5.5],
  'dance-pad-polisher': [2.5, 2.5],
  'aniipod-maker': [4.5, 4.5],
};
export const STORAGE: [number, number] = [2, 2];

/** Le terrain : 4×4 parcelles de 20×15 cases ; la parcelle n s'ouvre au niveau n (toutes au 16). */
export const PLOT_SIZE = { w: 20, h: 15 };
export const PLOT_GRID = [
  [13, 14, 15, 16],
  [12, 7, 8, 9],
  [11, 4, 3, 6],
  [10, 2, 1, 5],
];

/** Parcelles de terrain ouvertes au niveau `rv`, en cases. */
export function openCells(rv: number): (Rect & { plot: number })[] {
  const cells: (Rect & { plot: number })[] = [];
  PLOT_GRID.forEach((row, j) =>
    row.forEach((plot, i) => {
      if (plot <= rv || rv >= 16) cells.push({ plot, x: i * PLOT_SIZE.w, y: j * PLOT_SIZE.h, w: PLOT_SIZE.w, h: PLOT_SIZE.h });
    }),
  );
  return cells;
}

export interface PlacedPiece {
  facility: string;
  /** Ce que l'installation produit (cultures et transformations). */
  item: string | null;
  rect: Rect;
  /** Allers-retours par heure vers l'Entrepôt. */
  trips: number;
  /** Appareil climatique et ses parcelles : même numéro de groupe. */
  group?: number;
  covered?: boolean;
}

export interface HomelandPlan {
  storage: Rect;
  pieces: PlacedPiece[];
  unplaced: { facility: string; item: string | null }[];
  cells: (Rect & { plot: number })[];
  /** Distance totale parcourue par heure (cases), pour comparer des plans. */
  walk: number;
}

/**
 * Construit les pièces à poser depuis le plan de production (parcelles et machines entières) et
 * le placement climatique, puis les place.
 */
export function homelandPlan(rows: PlanRow[], whole: Map<PlanRow, number>, climate: ClimateLayout, rv: number): HomelandPlan {
  const pieces: Piece[] = [];
  const meta: { facility: string; item: string | null; group?: number; covered?: boolean }[][] = [];

  // Appareils climatiques et leurs parcelles : un groupe chacun, gardé tel que prévu.
  climate.zones.forEach((z, g) => {
    if (!z.plots.length) return;
    const rowOf = (crop: string, env: string) => rows.find((r) => r.covered && r.recipe.output.item === crop && r.recipe.environment === env);
    // Paire : Fournaise puis Climatisation, chaque parcelle gardée dans sa zone (0, 1 ou 2).
    const buildings = [{ x: 0, y: 0, w: z.size, h: z.size }, ...(z.pair ? [{ x: z.pair.dx, y: z.pair.dy, w: 2, h: 2 }] : [])];
    pieces.push({
      cluster: true,
      buildings,
      plots: z.plots.map((p) => {
        const r = rowOf(p.crop, p.env ?? z.env);
        return { x: 0, y: 0, w: p.size, h: p.size, zone: p.zone ?? 0, weight: r ? 3600 / r.cycleSeconds : 0 };
      }),
      planned: z.plots.map((p) => ({ x: p.x, y: p.y })),
    });
    meta.push([
      { facility: z.device, item: null, group: g },
      ...(z.pair ? [{ facility: 'cooling-unit', item: null, group: g }] : []),
      ...z.plots.map((p) => ({ facility: p.facility, item: p.crop, group: g, covered: true })),
    ]);
  });

  // Le reste : une pièce par parcelle ou par machine.
  const coveredLeft = new Map<PlanRow, number>();
  for (const z of climate.zones) for (const p of z.plots) {
    const r = rows.find((x) => x.covered && x.recipe.output.item === p.crop && x.recipe.environment === (p.env ?? z.env));
    if (r) coveredLeft.set(r, (coveredLeft.get(r) ?? 0) + 1);
  }
  const byFacility = new Map<string, { row: PlanRow; trips: number }[]>();
  for (const r of rows) {
    const f = r.recipe.facility;
    if (!FOOTPRINT[f]) continue;
    const perUnit = 3600 / r.cycleSeconds; // lots terminés par heure et par exemplaire
    if (r.recipe.kind === 'processor') {
      (byFacility.get(f) ?? byFacility.set(f, []).get(f)!).push({ row: r, trips: perUnit * r.units });
      continue;
    }
    // Culture et collecte : parcelles entières, moins celles déjà posées dans une zone.
    const n = (whole.get(r) ?? 0) - (coveredLeft.get(r) ?? 0);
    for (let k = 0; k < n; k++) {
      const [w, h] = FOOTPRINT[f];
      pieces.push({ members: [{ x: 0, y: 0, w, h, weight: perUnit, sensitive: !!r.recipe.environment && !r.covered }] });
      meta.push([{ facility: f, item: r.recipe.output.item }]);
    }
  }
  // Machines de transformation : autant que le plan en occupe (arrondi au-dessus), le travail
  // réparti entre elles.
  for (const [f, list] of byFacility) {
    const units = Math.max(1, Math.ceil(list.reduce((s, x) => s + x.row.units, 0) - 1e-6));
    const trips = list.reduce((s, x) => s + x.trips, 0) / units;
    const main = [...list].sort((a, b) => b.trips - a.trips)[0].row.recipe.output.item;
    for (let k = 0; k < units; k++) {
      const [w, h] = FOOTPRINT[f];
      pieces.push({ members: [{ x: 0, y: 0, w, h, weight: trips }] });
      meta.push([{ facility: f, item: main }]);
    }
  }

  const cells = openCells(rv);
  const out: LayoutResult = layOutHomeland(pieces, cells, { w: STORAGE[0], h: STORAGE[1] });
  const placed: PlacedPiece[] = [];
  const unplaced: HomelandPlan['unplaced'] = [];
  out.pieces.forEach((p, i) => {
    if (!p.members.length) {
      unplaced.push({ facility: meta[i][0].facility, item: meta[i][0].item });
      return;
    }
    p.members.forEach((m, j) => {
      const info = meta[i][j] ?? meta[i][0];
      placed.push({ ...info, rect: { x: m.x, y: m.y, w: m.w, h: m.h }, trips: m.weight ?? 0 });
    });
  });
  const walk = placed.reduce((s, p) => s + p.trips * Math.hypot(p.rect.x + p.rect.w / 2 - out.storageAt.x, p.rect.y + p.rect.h / 2 - out.storageAt.y), 0);
  return { storage: out.storage, pieces: placed, unplaced, cells, walk };
}
