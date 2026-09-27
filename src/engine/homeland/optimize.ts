import solver from 'javascript-lp-solver';
import type { AbilityId } from '../abilities';
import { FACILITY_BY_ID, HOMELAND, RECIPES, atRv, type Recipe } from '../../data/homeland';
import { uncoveredFactor, wateredSeconds, workSeconds } from './speed';

// Optimiseur de production du Logis.
//
// Programme linéaire : chaque recette reçoit un nombre (fractionnaire) d'exemplaires
// d'installation. On maximise la vitesse à laquelle on réunit ce qui manque pour le prochain
// niveau de Camping-car (pièces + matériaux), puis, à cette vitesse, les pièces gagnées en plus.
// Les objets peuvent être vendus, transformés ou gardés pour le niveau suivant.

export interface Setup {
  rv: number;
  facilities: Record<string, { count: number; level: number }>;
  modules: Record<string, number>;
}

/** Tout ce qu'un joueur peut avoir à ce niveau : chaque installation au maximum débloqué. */
export function setupForRv(rv: number): Setup {
  const facilities: Setup['facilities'] = {};
  for (const f of HOMELAND.facilities) {
    const levels = Object.entries(f.unlocks)
      .filter(([, need]) => need <= rv)
      .map(([lvl]) => Number(lvl));
    facilities[f.id] = levels.length ? { count: atRv(f.counts, rv), level: Math.max(...levels) } : { count: 0, level: 0 };
  }
  const modules = Object.fromEntries(Object.entries(HOMELAND.moduleMaxLevels).map(([id, caps]) => [id, atRv(caps, rv)]));
  return { rv, facilities, modules };
}

export interface WorkerSlot {
  level: number;
  personality: string | null;
}

/** Les ouvriers disponibles, par capacité (un même Aniimo peut apparaître sous plusieurs capacités). */
export interface WorkerPool {
  kind: 'ideal' | 'roster';
  byAbility: Partial<Record<AbilityId, WorkerSlot[]>>;
  /** Nombre d'Aniimo pouvant travailler en même temps. */
  total: number;
}

/** Des Aniimo « idéaux » : niveau 3 (maximum hors prismana) avec la bonne personnalité partout. */
export function idealPool(total: number, level = 3): WorkerPool {
  const slot = { level, personality: 'IENSFTPJ' };
  const abilities: AbilityId[] = ['fire', 'grass', 'water', 'earth', 'lightning', 'ice', 'wind', 'dark', 'light', 'hauling', 'artisanship', 'leisure', 'perfumery'];
  return { kind: 'ideal', total, byAbility: Object.fromEntries(abilities.map((a) => [a, Array.from({ length: total }, () => slot)])) };
}

export function rosterPool(workers: { homeland: Partial<Record<AbilityId, number>>; personality: string | null }[]): WorkerPool {
  const byAbility: WorkerPool['byAbility'] = {};
  for (const w of workers) {
    for (const [a, level] of Object.entries(w.homeland) as [AbilityId, number][]) (byAbility[a] ??= []).push({ level, personality: w.personality });
  }
  for (const list of Object.values(byAbility)) list!.sort((x, y) => y.level - x.level);
  return { kind: 'roster', byAbility, total: workers.length };
}

export type Goal = { kind: 'levelUp'; stock: { coins: number; items: Record<string, number> } } | { kind: 'coins' };

export interface PlanOptions {
  setup: Setup;
  workers: WorkerPool;
  goal: Goal;
  /** Les Aniimo Eau arrosent les cultures (−25 % de temps de pousse). */
  watering: boolean;
  includeUnverified: boolean;
}

export interface PlanRow {
  recipe: Recipe;
  /** Exemplaires d'installation consacrés (fractionnaire : une partie du temps). */
  units: number;
  covered: boolean;
  cycleSeconds: number;
  workerLevel: number | null;
  personalityBonus: boolean;
  outputPerHour: number;
}

export interface Plan {
  feasible: boolean;
  /** Heures pour réunir le coût du prochain niveau (null si objectif « pièces »). */
  hours: number | null;
  /** Pièces nettes par heure (ventes − graines). */
  coinsPerHour: number;
  rows: PlanRow[];
  sales: { item: string; perHour: number; coinsPerHour: number }[];
  /** Matériaux du prochain niveau accumulés par heure. */
  stockPerHour: Record<string, number>;
  target: { coins: number; items: Record<string, number> } | null;
  remaining: { coins: number; items: Record<string, number> } | null;
  facilityUse: { facility: string; used: number; count: number }[];
  workersUsed: Partial<Record<AbilityId, number>>;
  blockers: string[];
}

const ENV_BUILDING: Record<string, string> = { Warm: 'heat-furnace', Scorching: 'heat-furnace', Cool: 'cooling-unit', Freeze: 'cooling-unit', Adequate: 'sunlamp' };
/** Emplacements couverts par un bâtiment climatique (zone ≈ 9×9 cases, à confirmer en jeu). */
const COVER = (facility: string) => {
  const side = { farmland: 2, woodland: 4 }[facility] ?? 5;
  return Math.floor(9 / side) ** 2;
};

function recipeAllowed(r: Recipe, o: PlanOptions): boolean {
  const f = o.setup.facilities[r.facility];
  if (!f || f.count <= 0 || f.level < r.level) return false;
  if (r.module && (o.setup.modules[r.module.id] ?? 0) < r.module.level) return false;
  if (HOMELAND.specialRecipes.includes(r.id)) return false;
  if (!r.verified && !o.includeUnverified) return false;
  if (r.environment && !ENV_BUILDING[r.environment]) return false;
  // Les objets hors pièces (Aniipods, EXP) ne comptent pas pour monter de niveau.
  const cur = HOMELAND.items[r.output.item]?.currency;
  return cur === 'coins' || cur === 'none';
}

/**
 * Les « profils » d'ouvrier possibles pour une recette travaillée : chaque niveau présent dans
 * l'équipe (≥ niveau requis), avec ou sans la personnalité de l'installation. Chaque exemplaire
 * d'installation reçoit son propre Aniimo : 4 mines demandent 4 Aniimo Terre, et seules celles qui
 * ont un Aniimo niv. 3 vont à la vitesse du niveau 3. null si personne n'a le niveau requis.
 */
function workerTiers(r: Recipe, pool: WorkerPool): { level: number; bonus: boolean }[] | null {
  if (r.kind === 'grower' || !r.ability) return [{ level: 0, bonus: false }];
  const letter = FACILITY_BY_ID.get(r.facility)?.personality;
  const able = (pool.byAbility[r.ability] ?? []).filter((w) => w.level >= (r.abilityLevel ?? 1));
  if (!able.length) return null;
  const tiers = new Map<string, { level: number; bonus: boolean }>();
  for (const w of able) {
    const bonus = !!letter && !!w.personality?.includes(letter);
    tiers.set(`${w.level}${bonus}`, { level: w.level, bonus });
  }
  return [...tiers.values()];
}

export function plan(o: PlanOptions): Plan {
  const target = o.goal.kind === 'levelUp' ? HOMELAND.levelUp[String(o.setup.rv + 1)] ?? null : null;
  const remaining = target && o.goal.kind === 'levelUp'
    ? {
        coins: Math.max(0, target.coins - o.goal.stock.coins),
        items: Object.fromEntries(Object.entries(target.items).map(([id, n]) => [id, Math.max(0, n - (o.goal.kind === 'levelUp' ? o.goal.stock.items[id] ?? 0 : 0))])),
      }
    : null;

  const variables: Record<string, Record<string, number>> = {};
  const constraints: Record<string, { min?: number; max?: number; equal?: number }> = {};
  const meta = new Map<string, Omit<PlanRow, 'units' | 'outputPerHour'> & { perUnit: number }>();
  const blockers = new Set<string>();

  for (const r of RECIPES) {
    if (!recipeAllowed(r, o)) continue;
    const tiers = workerTiers(r, o.workers);
    if (!tiers) {
      blockers.add(`${r.ability}:${r.abilityLevel}`);
      continue;
    }
    const variants: { key: string; covered: boolean; factor: number }[] = [];
    if (!r.environment) variants.push({ key: r.id, covered: false, factor: 1 });
    else {
      if ((o.setup.facilities[ENV_BUILDING[r.environment]]?.count ?? 0) > 0) variants.push({ key: r.id, covered: true, factor: 1 });
      const u = r.kind === 'grower' ? uncoveredFactor(r.environment) : null;
      if (u) variants.push({ key: `${r.id}~hors-zone`, covered: false, factor: u });
    }
    const letter = FACILITY_BY_ID.get(r.facility)?.personality;
    for (const v of variants) for (const w of tiers) {
      const key = r.kind === 'grower' ? v.key : `${v.key}@${w.level}${w.bonus ? '+' : ''}`;
      let seconds: number;
      if (r.kind === 'grower') {
        const grow = r.seconds! / v.factor;
        seconds = o.watering ? wateredSeconds(grow, r.seconds!) : grow;
      } else {
        seconds = workSeconds({
          facility: r.facility,
          workload: r.workload!,
          required: r.abilityLevel ?? 1,
          level: w.level,
          personality: w.bonus,
          gathering: r.kind === 'gatherer',
        });
      }
      const cycles = 3600 / seconds; // lots par heure et par exemplaire
      const col: Record<string, number> = { [`fac:${r.facility}`]: 1 };
      col[`item:${r.output.item}`] = (col[`item:${r.output.item}`] ?? 0) + r.output.qty * cycles;
      if (r.byproduct) col[`item:${r.byproduct.item}`] = (col[`item:${r.byproduct.item}`] ?? 0) + r.byproduct.qty * cycles;
      for (const i of r.inputs) col[`item:${i.item}`] = (col[`item:${i.item}`] ?? 0) - i.qty * cycles;
      if (r.seedCost) {
        col.coins = -r.seedCost * cycles;
        col.profit = -r.seedCost * cycles;
      }
      if (v.covered && r.environment) col[`env:${ENV_BUILDING[r.environment]}`] = 1 / COVER(r.facility);
      if (r.kind !== 'grower' && r.ability) {
        // Un Aniimo de niveau ≥ w.level (et de la bonne lettre si bonus) est occupé par exemplaire.
        col.workers = 1;
        for (let l = 1; l <= w.level; l++) {
          col[`ab:${r.ability}:${l}`] = 1;
          if (w.bonus) col[`pb:${r.ability}:${letter}:${l}`] = 1;
        }
      }
      variables[key] = col;
      meta.set(key, { recipe: r, covered: v.covered, cycleSeconds: seconds, workerLevel: r.kind === 'grower' ? null : w.level, personalityBonus: w.bonus, perUnit: r.output.qty * cycles });
    }
  }

  // Ventes.
  for (const [id, it] of Object.entries(HOMELAND.items)) {
    if (it.currency === 'coins' && it.sellValue > 0) variables[`sell:${id}`] = { [`item:${id}`]: -1, coins: it.sellValue, profit: it.sellValue };
  }

  // Contraintes : installations, climat, ouvriers, bilans.
  for (const [id, f] of Object.entries(o.setup.facilities)) if (f.count > 0) constraints[`fac:${id}`] = { max: f.count };
  for (const b of ['heat-furnace', 'cooling-unit', 'sunlamp']) constraints[`env:${b}`] = { max: o.setup.facilities[b]?.count ?? 0 };
  constraints.workers = { max: o.workers.total };
  for (const [a, list] of Object.entries(o.workers.byAbility)) {
    for (let l = 1; l <= 4; l++) {
      const able = list!.filter((w) => w.level >= l);
      constraints[`ab:${a}:${l}`] = { max: able.length };
      for (const x of 'IENSFTPJ') constraints[`pb:${a}:${x}:${l}`] = { max: able.filter((w) => w.personality?.includes(x)).length };
    }
  }
  const itemKeys = new Set(Object.values(variables).flatMap((c) => Object.keys(c).filter((k) => k.startsWith('item:'))));
  for (const k of itemKeys) constraints[k] = { min: 0 };
  constraints.coins = { min: 0 };

  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  let hours: number | null = null;
  let solution: Record<string, number> = {};

  if (remaining) {
    // Passe 1 : vitesse maximale vers le prochain niveau (t = fraction de l'objectif réunie par heure).
    const t: Record<string, number> = { t: 1 };
    if (remaining.coins > 0) t.coins = -remaining.coins;
    for (const [id, n] of Object.entries(remaining.items)) if (n > 0) {
      t[`item:${id}`] = -n;
      constraints[`item:${id}`] = { min: 0 };
    }
    const needs = remaining.coins > 0 || Object.values(remaining.items).some((n) => n > 0);
    if (!needs) hours = 0;
    else {
      variables.t = t;
      const r1 = solver.Solve({ optimize: 't', opType: 'max', constraints, variables }) as Record<string, number> & { feasible: boolean };
      const best = r1.feasible ? r1.t ?? 0 : 0;
      if (best <= 1e-9) return emptyPlan(target, remaining, [...blockers], o);
      hours = 1 / best;
      // Passe 2 : à 99,9 % de cette vitesse, un maximum de pièces en plus.
      constraints.tmin = { min: best * 0.999 };
      variables.t = { ...t, tmin: 1 };
    }
  }
  const r2 = solver.Solve({ optimize: 'profit', opType: 'max', constraints, variables }) as Record<string, number> & { feasible: boolean };
  if (!r2.feasible) return emptyPlan(target, remaining, [...blockers], o);
  solution = r2;

  const rows: PlanRow[] = [];
  for (const [key, m] of meta) {
    const units = round(solution[key] ?? 0);
    if (units > 1e-4) rows.push({ ...m, units, outputPerHour: units * m.perUnit });
  }
  rows.sort((a, b) => a.recipe.facility.localeCompare(b.recipe.facility) || b.units - a.units);

  const sales = Object.entries(solution)
    .filter(([k, v]) => k.startsWith('sell:') && v > 1e-6)
    .map(([k, v]) => ({ item: k.slice(5), perHour: v, coinsPerHour: v * HOMELAND.items[k.slice(5)].sellValue }))
    .sort((a, b) => b.coinsPerHour - a.coinsPerHour);
  const seeds = rows.reduce((s, r) => s + (r.recipe.seedCost ?? 0) * (3600 / r.cycleSeconds) * r.units, 0);
  const coinsPerHour = sales.reduce((s, x) => s + x.coinsPerHour, 0) - seeds;

  const stockPerHour: Record<string, number> = {};
  if (target) for (const id of Object.keys(target.items)) {
    stockPerHour[id] = rows.reduce((s, r) => {
      const c = 3600 / r.cycleSeconds;
      let v = 0;
      if (r.recipe.output.item === id) v += r.recipe.output.qty * c;
      if (r.recipe.byproduct?.item === id) v += r.recipe.byproduct.qty * c;
      for (const i of r.recipe.inputs) if (i.item === id) v -= i.qty * c;
      return s + v * r.units;
    }, 0);
  }

  const facilityUse = Object.entries(o.setup.facilities)
    .filter(([, f]) => f.count > 0)
    .map(([id, f]) => ({ facility: id, count: f.count, used: rows.filter((r) => r.recipe.facility === id).reduce((s, r) => s + r.units, 0) }));
  const workersUsed: Plan['workersUsed'] = {};
  for (const r of rows) if (r.recipe.ability && r.recipe.kind !== 'grower') workersUsed[r.recipe.ability] = (workersUsed[r.recipe.ability] ?? 0) + r.units;

  return { feasible: true, hours, coinsPerHour, rows, sales, stockPerHour, target, remaining, facilityUse, workersUsed, blockers: [...blockers] };
}

function emptyPlan(target: Plan['target'], remaining: Plan['remaining'], blockers: string[], o: PlanOptions): Plan {
  return {
    feasible: false, hours: null, coinsPerHour: 0, rows: [], sales: [], stockPerHour: {}, target, remaining,
    facilityUse: Object.entries(o.setup.facilities).filter(([, f]) => f.count > 0).map(([id, f]) => ({ facility: id, count: f.count, used: 0 })),
    workersUsed: {}, blockers,
  };
}

export interface RoadmapStep {
  rv: number;
  hours: number | null;
  coinsPerHour: number;
  cost: { coins: number; items: Record<string, number> };
  plan: Plan;
}

/** Temps pour passer chaque niveau, du niveau `from` jusqu'au 20, en partant de zéro à chaque fois. */
export function roadmap(from: number, workers: (rv: number) => WorkerPool, opts: Pick<PlanOptions, 'watering' | 'includeUnverified'>): RoadmapStep[] {
  const steps: RoadmapStep[] = [];
  for (let rv = Math.max(1, from); rv < 20; rv++) {
    const p = plan({ ...opts, setup: setupForRv(rv), workers: workers(rv), goal: { kind: 'levelUp', stock: { coins: 0, items: {} } } });
    steps.push({ rv, hours: p.hours, coinsPerHour: p.coinsPerHour, cost: HOMELAND.levelUp[String(rv + 1)], plan: p });
  }
  return steps;
}

/**
 * Arrondit les exemplaires à des nombres entiers par installation (on ne pose pas 0,4 champ) :
 * méthode du plus fort reste, en gardant le total arrondi. Les installations de transformation,
 * occupées une fraction du temps, gardent leur part en pourcentage.
 */
export function wholeUnits(rows: PlanRow[]): Map<PlanRow, number> {
  const out = new Map<PlanRow, number>();
  const byFacility = new Map<string, PlanRow[]>();
  for (const r of rows) byFacility.set(r.recipe.facility, [...(byFacility.get(r.recipe.facility) ?? []), r]);
  for (const list of byFacility.values()) {
    const total = Math.round(list.reduce((s, r) => s + r.units, 0));
    const base = list.map((r) => Math.floor(r.units));
    let left = total - base.reduce((a, b) => a + b, 0);
    const order = list.map((r, i) => [r.units - base[i], i] as const).sort((a, b) => b[0] - a[0]);
    for (const [, i] of order) if (left-- > 0) base[i] += 1;
    list.forEach((r, i) => out.set(r, base[i]));
  }
  return out;
}
