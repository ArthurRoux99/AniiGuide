import type { ClimateLayout } from './climate';
import { layOutHomeland, type LayoutResult, type Piece, type Rect, type RigidPiece } from './layout.js';
import type { PlanRow } from './optimize';
import { GENERATOR, powerLayout, type PowerLayout } from './power-layout';

/** Priorité donnée aux installations électriques dans le placement (lots/h ajoutés au poids). */
const ELECTRIC_PRIORITY = 1000;

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
      if (plot <= rv || rv >= 16)
        cells.push({
          plot,
          x: i * PLOT_SIZE.w,
          y: j * PLOT_SIZE.h,
          w: PLOT_SIZE.w,
          h: PLOT_SIZE.h,
        });
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
  /** En mode électrique : doit toucher la zone du Générateur ou d'un Poteau. */
  electric?: boolean;
  /** Mode électrique, mais hors du réseau posé (plus de Poteaux autorisés à ce niveau). */
  unpowered?: boolean;
}

export interface HomelandPlan {
  storage: Rect;
  pieces: PlacedPiece[];
  unplaced: { facility: string; item: string | null }[];
  cells: (Rect & { plot: number })[];
  /** Distance totale parcourue par heure (cases), pour comparer des plans. */
  walk: number;
  /** Réseau électrique : Générateur crépitant et Poteaux (null sans installation électrique). */
  power: Pick<PowerLayout, 'generator' | 'poles'> | null;
}

/**
 * Construit les pièces à poser depuis le plan de production (parcelles et machines entières) et
 * le placement climatique, puis les place.
 */
export function homelandPlan(
  rows: PlanRow[],
  whole: Map<PlanRow, number>,
  climate: ClimateLayout,
  rv: number,
  machines?: Record<string, number>,
): HomelandPlan {
  const pieces: Piece[] = [];
  const meta: {
    facility: string;
    item: string | null;
    group?: number;
    covered?: boolean;
    electric?: boolean;
  }[][] = [];
  // Machines électriques à poser par recette (calcul exact) ou par installation.
  const elecUnits = new Map<string, number>();
  for (const r of rows) if (r.electric) for (const k of [r.recipe.id, r.recipe.facility]) elecUnits.set(k, (elecUnits.get(k) ?? 0) + r.units);
  const elecLeft = new Map([...elecUnits].map(([k, u]) => [k, Math.ceil(u - 1e-6)]));
  const takeElec = (k: string) => {
    const n = elecLeft.get(k) ?? 0;
    if (n > 0) elecLeft.set(k, n - 1);
    return n > 0;
  };

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
        return {
          x: 0,
          y: 0,
          w: p.size,
          h: p.size,
          zone: p.zone ?? 0,
          weight: r ? 3600 / r.cycleSeconds : 0,
        };
      }),
      planned: z.plots.map((p) => ({ x: p.x, y: p.y })),
    });
    meta.push([
      { facility: z.device, item: null, group: g },
      ...(z.pair ? [{ facility: 'cooling-unit', item: null, group: g }] : []),
      ...z.plots.map((p) => ({
        facility: p.facility,
        item: p.crop,
        group: g,
        covered: true,
      })),
    ]);
  });

  // Le reste : une pièce par parcelle ou par machine.
  const coveredLeft = new Map<PlanRow, number>();
  for (const z of climate.zones)
    for (const p of z.plots) {
      const r = rows.find((x) => x.covered && x.recipe.output.item === p.crop && x.recipe.environment === (p.env ?? z.env));
      if (r) coveredLeft.set(r, (coveredLeft.get(r) ?? 0) + 1);
    }
  const byFacility = new Map<string, { row: PlanRow; trips: number }[]>();
  for (const r of rows) {
    const f = r.recipe.facility;
    if (!FOOTPRINT[f]) continue;
    const perUnit = 3600 / r.cycleSeconds; // lots terminés par heure et par exemplaire
    if (r.recipe.kind === 'processor') {
      (byFacility.get(f) ?? byFacility.set(f, []).get(f)!).push({
        row: r,
        trips: perUnit * r.units,
      });
      continue;
    }
    // Culture et collecte : parcelles entières, moins celles déjà posées dans une zone.
    const n = (whole.get(r) ?? 0) - (coveredLeft.get(r) ?? 0);
    for (let k = 0; k < n; k++) {
      const [w, h] = FOOTPRINT[f];
      pieces.push({
        members: [
          {
            x: 0,
            y: 0,
            w,
            h,
            weight: perUnit,
            sensitive: !!r.recipe.environment && !r.covered,
          },
        ],
      });
      meta.push([{ facility: f, item: r.recipe.output.item, electric: r.electric }]);
    }
  }
  // Machines de transformation. Calcul exact : chaque machine dédiée à sa recette.
  if (machines) {
    // Une recette peut avoir plusieurs lignes (niveaux d'Aniimo) : regroupées par recette.
    const byRecipe = new Map<string, { row: PlanRow; trips: number }>();
    for (const list of byFacility.values())
      for (const x of list) {
        const cur = byRecipe.get(x.row.recipe.id);
        byRecipe.set(x.row.recipe.id, cur ? { row: cur.row, trips: cur.trips + x.trips } : x);
      }
    for (const { row, trips } of byRecipe.values()) {
      const n = machines[row.recipe.id] ?? 0;
      if (!n) continue;
      const [w, h] = FOOTPRINT[row.recipe.facility];
      for (let k = 0; k < n; k++) {
        pieces.push({ members: [{ x: 0, y: 0, w, h, weight: trips / n }] });
        meta.push([
          {
            facility: row.recipe.facility,
            item: row.recipe.output.item,
            electric: takeElec(row.recipe.id),
          },
        ]);
      }
    }
    // Établi de menuiserie et Four de cheminée alternent entre leurs paliers : traités ci-dessous.
    for (const f of [...byFacility.keys()]) if (byFacility.get(f)!.some((x) => machines[x.row.recipe.id])) byFacility.delete(f);
  }
  // Sinon : autant de machines que le plan en occupe (arrondi au-dessus), le travail réparti.
  for (const [f, list] of byFacility) {
    const units = Math.max(1, Math.ceil(list.reduce((s, x) => s + x.row.units, 0) - 1e-6));
    const trips = list.reduce((s, x) => s + x.trips, 0) / units;
    const main = [...list].sort((a, b) => b.trips - a.trips)[0].row.recipe.output.item;
    for (let k = 0; k < units; k++) {
      const [w, h] = FOOTPRINT[f];
      pieces.push({ members: [{ x: 0, y: 0, w, h, weight: trips }] });
      meta.push([{ facility: f, item: main, electric: takeElec(f) }]);
    }
  }

  // Réseau électrique : le Générateur est posé contre l'Entrepôt (poids maximal), et les
  // installations électriques passent devant les autres pour rester dans sa zone ou près d'elle.
  // Si certaines restent hors réseau, le placement est refait (deux fois au plus) en les faisant
  // passer encore devant ; on garde le meilleur.
  const rigid = (p: Piece): p is RigidPiece => !('cluster' in p);
  const trips = pieces.map((p) => (rigid(p) ? p.members.map((m) => m.weight) : []));
  const cells = openCells(rv);
  const boost = pieces.map(() => 0);
  let best: HomelandPlan | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = layOut(structuredClone(pieces), meta, trips, boost, cells, rv);
    const missing = r.plan.pieces.filter((p) => p.unpowered).length;
    if (!best || missing < best.pieces.filter((p) => p.unpowered).length) best = r.plan;
    if (!missing) break;
    for (const i of r.unpoweredPieces) boost[i] += 2;
  }
  return best!;
}

function layOut(
  pieces: Piece[],
  meta: {
    facility: string;
    item: string | null;
    group?: number;
    covered?: boolean;
    electric?: boolean;
  }[][],
  trips: number[][],
  boost: number[],
  cells: (Rect & { plot: number })[],
  rv: number,
): { plan: HomelandPlan; unpoweredPieces: number[] } {
  const rigid = (p: Piece): p is RigidPiece => !('cluster' in p);
  const hasElec = meta.some((m) => m.some((x) => x.electric));
  if (hasElec) {
    // Les petites installations électriques au plus près : les grandes touchent la zone de plus loin.
    pieces.forEach((p, i) => {
      if (rigid(p) && meta[i][0].electric) p.members.forEach((m) => (m.weight += ELECTRIC_PRIORITY * (1 + boost[i]) + 100 / (m.w * m.h)));
    });
    pieces.push({
      members: [
        {
          x: 0,
          y: 0,
          w: GENERATOR.size,
          h: GENERATOR.size,
          weight: ELECTRIC_PRIORITY * 100,
        },
      ],
    });
    meta = [...meta, [{ facility: 'crackle-generator', item: null }]];
    trips = [...trips, [0]];
  }
  const out: LayoutResult = layOutHomeland(pieces, cells, {
    w: STORAGE[0],
    h: STORAGE[1],
  });
  const placed: (PlacedPiece & { piece: number })[] = [];
  const unplaced: HomelandPlan['unplaced'] = [];
  out.pieces.forEach((p, i) => {
    if (!p.members.length) {
      unplaced.push({ facility: meta[i][0].facility, item: meta[i][0].item });
      return;
    }
    p.members.forEach((m, j) => {
      const info = meta[i][j] ?? meta[i][0];
      placed.push({
        ...info,
        piece: i,
        rect: { x: m.x, y: m.y, w: m.w, h: m.h },
        trips: trips[i]?.[j] ?? m.weight ?? 0,
      });
    });
  });
  // Réseau électrique autour des installations électriques déjà placées.
  const genIdx = placed.findIndex((p) => p.facility === 'crackle-generator');
  const genRect = genIdx >= 0 ? placed.splice(genIdx, 1)[0].rect : undefined;
  const elec = placed.filter((p) => p.electric);
  let power: HomelandPlan['power'] = null;
  if (elec.length) {
    // Seules les pièces posées seules (pas les zones climatiques) peuvent échanger leur place.
    const loose = placed.filter((p) => !p.electric && p.group == null);
    const net = powerLayout(
      cells,
      [out.storage, ...placed.map((p) => p.rect), ...(genRect ? [genRect] : [])],
      elec.map((p) => p.rect),
      rv,
      loose.map((p) => p.rect),
      genRect,
    );
    for (const m of net.moves) {
      if (m.swapWith != null) loose[m.swapWith].rect = { ...elec[m.target].rect };
      elec[m.target].rect = { ...m.to };
    }
    for (const i of net.unpowered) elec[i].unpowered = true;
    power = { generator: net.generator, poles: net.poles };
  }
  const walk = placed.reduce(
    (s, p) => s + p.trips * Math.hypot(p.rect.x + p.rect.w / 2 - out.storageAt.x, p.rect.y + p.rect.h / 2 - out.storageAt.y),
    0,
  );
  const unpoweredPieces = [...new Set(placed.filter((p) => p.unpowered).map((p) => p.piece))];
  const clean: PlacedPiece[] = placed.map(({ piece: _piece, ...rest }) => rest);
  return {
    plan: { storage: out.storage, pieces: clean, unplaced, cells, walk, power },
    unpoweredPieces,
  };
}
