import { solveLP } from '../lp';
import type { AbilityId } from '../abilities';
import { FACILITY_BY_ID, HOMELAND, RECIPES, atRv, type Environment, type Recipe } from '../../data/homeland';
import { uncoveredFactor, wateredSeconds, workSeconds } from './speed';
import { layoutsFor, PAIR_COMBOS, PAIR_KINDS, PAIR_LAYOUTS, PLOT_KIND, type PlotKind } from './coverage';

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

/**
 * Installations du joueur : le maximum du niveau, corrigé par ce qu'il a réellement posé
 * (nombre et niveau bornés par ce que le niveau de Camping-car permet).
 */
export function setupWithOverrides(rv: number, overrides: Record<string, { count: number; level: number }>): Setup {
  const base = setupForRv(rv);
  const facilities = { ...base.facilities };
  for (const [id, o] of Object.entries(overrides)) {
    const max = base.facilities[id];
    if (!max) continue;
    facilities[id] = { count: Math.min(o.count, max.count), level: Math.min(o.level, max.level) };
  }
  return { ...base, facilities };
}

export interface WorkerSlot {
  level: number;
  personality: string | null;
}

/** Les ouvriers disponibles, par capacité (un même Aniimo peut apparaître sous plusieurs capacités). */
export interface WorkerPool {
  kind: 'ideal' | 'roster' | 'team';
  byAbility: Partial<Record<AbilityId, WorkerSlot[]>>;
  /** Nombre d'Aniimo pouvant travailler en même temps. */
  total: number;
  /** Mode « équipe à composer » : l'optimiseur choisit aussi les Aniimo (voir teamPool). */
  team?: TeamSpec;
}

export interface TeamProfile {
  key: string;
  homeland: Partial<Record<AbilityId, number>>;
  /** Aniimo de ce profil déjà au logis : l'optimiseur les garde en priorité. */
  owned?: number;
}

export interface TeamSpec {
  profiles: TeamProfile[];
  /** Places d'Aniimo disponibles. */
  cap: number;
  /** Suppose que chaque recrue a la bonne personnalité pour son poste. */
  personality: boolean;
  /** Capacités dont il faut au moins un Aniimo (travail aux champs, transport). */
  mustHave: AbilityId[];
}

/**
 * Équipe à composer : l'optimiseur choisit combien d'Aniimo de chaque profil recruter (nombres
 * entiers, `cap` au plus) en même temps que la production. Chaque Aniimo occupe un poste à la fois,
 * dans l'une de ses capacités.
 */
export function teamPool(spec: TeamSpec): WorkerPool {
  const byAbility: WorkerPool['byAbility'] = {};
  for (const p of spec.profiles) {
    for (const [a, level] of Object.entries(p.homeland) as [AbilityId, number][]) {
      (byAbility[a] ??= []).push({ level, personality: spec.personality ? 'IENSFTPJ' : null });
    }
  }
  return { kind: 'team', byAbility, total: spec.cap, team: spec };
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

export type Goal = { kind: 'levelUp'; stock: { coins: number; items: Record<string, number> } } | { kind: 'coins' } | { kind: 'points' };

export interface PlanOptions {
  setup: Setup;
  workers: WorkerPool;
  goal: Goal;
  /** Les Aniimo Eau arrosent les cultures (−25 % de temps de pousse). */
  watering: boolean;
  includeUnverified: boolean;
  /**
   * Un Aniimo attitré par installation travaillée : une cuisine utilisée 5 % du temps occupe alors
   * un Aniimo entier. Désactivé par défaut : en jeu, les Aniimo passent d'une installation à
   * l'autre selon les besoins (confirmé par un joueur).
   */
  dedicated?: boolean;
  /**
   * Calcul exact (plus lent) : parcelles entières, et chaque machine de transformation dédiée à
   * une seule recette (sauf l'Établi de menuiserie et le Four de cheminée, qui alternent entre
   * leurs paliers), comme en jeu. Sinon : calcul continu, arrondi ensuite.
   */
  exact?: boolean;
  /** Paires d'appareils aux zones chevauchantes (+1 à 4 % de pièces/h, calcul 4× plus lent : pour le plan principal seulement). */
  pairs?: boolean;
  /**
   * Nourrir les Aniimo du logis avec la production (par défaut) : chacun mange 10 par minute, et
   * le plan choisit les plats qui coûtent le moins en ventes perdues. Gamelle vide : le travail
   * ralentit fortement ou s'arrête (les sources divergent), donc le plan ne la laisse jamais vide.
   */
  feeding?: boolean;
  /**
   * Saison en cours (Lune des moissons, dès le niveau 10) : ses cultures et recettes, et les points
   * de l'événement gagnés sur chaque objet de saison vendu. `notes` : recettes débloquées par une
   * Note de recette. `wheatPerDay` : Blé de lune dépensable par jour en graines (null : sans limite).
   */
  season?: { notes: boolean; wheatPerDay: number | null };
  /**
   * Mode électrique (par défaut dès le niveau 12) : une installation peut tourner sur le réseau,
   * sans Aniimo, à la durée de lot du jeu ; le Générateur crépitant (un Aniimo Foudre à plein
   * temps) fournit la puissance que consomment ces installations. Taux d'alimentation = production
   * ÷ consommation, plafonné à 120 % (relevé en jeu) : le plan peut garder de la marge pour +20 %.
   */
  electric?: boolean;
}

/** Taux d'alimentation maximal : quand la production dépasse la consommation, tout va 20 % plus vite. */
export const ELECTRIC_BONUS = 1.2;

/** Puissance d'un générateur de niveau `level` tenu par un Aniimo Foudre de niveau `lightning`. */
export function generatorPower(level: number, lightning: number): number {
  const g = HOMELAND.emode!.generator;
  let best = 0;
  for (let i = 0; i < level; i++) if (g.lightning[i] <= lightning) best = g.power[i];
  return best;
}

/** Générateur crépitant au niveau `rv` du Camping-car : niveau, puissance, niveau Foudre demandé (null avant le 12). */
export function generatorAt(rv: number): { level: number; power: number; lightning: number } | null {
  const g = HOMELAND.emode?.generator;
  const level = g ? g.rv.filter((r) => rv >= r).length : 0;
  return g && level > 0 ? { level, power: g.power[level - 1], lightning: g.lightning[level - 1] } : null;
}

/** Ce que mange un Aniimo du logis, par heure (10 par minute). */
export const FOOD_PER_HOUR = 600;

export interface PlanRow {
  recipe: Recipe;
  /** Exemplaires d'installation consacrés (fractionnaire : une partie du temps). */
  units: number;
  covered: boolean;
  cycleSeconds: number;
  workerLevel: number | null;
  personalityBonus: boolean;
  outputPerHour: number;
  /** Installation en mode électrique : sur le réseau, sans Aniimo. */
  electric?: boolean;
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
  /** Appareils climatiques à régler : mode, nombre d'appareils ainsi réglés, parcelles couvertes. */
  climate: { device: string; env: Environment; zones: number; plots: number }[];
  /** Calcul exact : machines dédiées à chaque recette de transformation. */
  machines?: Record<string, number>;
  /** Paires Fournaise + Climatisation aux zones chevauchantes, par réglage. */
  pairs: { heat: Environment; cool: Environment; both: Environment; count: number }[];
  /** Mode équipe : combien d'Aniimo de chaque profil recruter. */
  team?: { key: string; count: number }[];
  /** Mode électrique : Générateurs en service, puissance produite et consommée. */
  electric?: { generators: number; level: number; lightning: number; rate: number; power: number; used: number };
  /** Saison : points de l'événement et Blé de lune dépensé en graines, par heure. */
  season?: { pointsPerHour: number; wheatPerHour: number };
  /** Gamelle : Aniimo nourris, nourriture par heure et plats prélevés sur la production. */
  food?: { eaters: number; perHour: number; dishes: { item: string; perHour: number }[] };
  /** Mode attitré : Aniimo postés par installation (niveau, bonus de personnalité). */
  staffing?: { facility: string; ability: AbilityId; level: number; bonus: boolean; count: number }[];
}

export const ENV_BUILDING: Record<string, string> = { Warm: 'heat-furnace', Scorching: 'heat-furnace', Cool: 'cooling-unit', Freeze: 'cooling-unit', Adequate: 'sunlamp' };
/** Chaque appareil climatique en service occupe un Aniimo toute la journée (confirmé en jeu, Aniimax). */
/** Installations qui alternent entre leurs paliers (chaque palier est fait du précédent). */
const TURN_TAKING = new Set(['woodworking-bench', 'chimney-kiln']);
export const ENV_STAFF: Record<string, AbilityId> = { 'heat-furnace': 'fire', 'cooling-unit': 'ice', sunlamp: 'light' };

function recipeAllowed(r: Recipe, o: PlanOptions): boolean {
  const f = o.setup.facilities[r.facility];
  if (!f || f.count <= 0 || f.level < r.level) return false;
  if (r.module && (o.setup.modules[r.module.id] ?? 0) < r.module.level) return false;
  if (HOMELAND.specialRecipes.includes(r.id)) return false;
  if (r.season) {
    if (!o.season || o.setup.rv < HOMELAND.season.minHomeLevel) return false;
    if (!o.season.notes && HOMELAND.season.recipeNotes.includes(r.id)) return false;
  }
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
  const ints: Record<string, 1> = {};
  const dedRecipes = new Map<string, string>();
  const constraints: Record<string, { min?: number; max?: number; equal?: number }> = {};
  const meta = new Map<string, Omit<PlanRow, 'units' | 'outputPerHour'> & { perUnit: number }>();
  const blockers = new Set<string>();
  const dedicated = o.dedicated ?? false;
  const staffTiers = new Map<string, { facility: string; ability: AbilityId; level: number; bonus: boolean; letter: string | null | undefined }>();

  const generator = o.electric !== false ? generatorAt(o.setup.rv) : null;
  for (const r of RECIPES) {
    if (!recipeAllowed(r, o)) continue;
    // Mode électrique : la machine tourne sur le réseau, sans Aniimo (même si personne n'a la capacité).
    const eSeconds = generator && r.kind !== 'grower' && !r.environment ? HOMELAND.emode?.seconds[r.id] : undefined;
    const ePower = HOMELAND.levels[r.facility]?.[(o.setup.facilities[r.facility]?.level ?? 0) - 1]?.power;
    // Deux régimes (voir le générateur plus bas) : réseau chargé (taux d'alimentation 100 %) ou
    // consommation ≤ production ÷ 1,2 (taux plafonné à 120 % : tout va 20 % plus vite).
    if (eSeconds && ePower) for (const rate of [1, ELECTRIC_BONUS]) {
      const key = rate > 1 ? `${r.id}~elec+` : `${r.id}~elec`;
      const seconds = eSeconds / rate;
      const cycles = 3600 / seconds;
      const oneRecipe = o.exact && r.kind === 'processor' && !TURN_TAKING.has(r.facility);
      const col: Record<string, number> = oneRecipe ? { [`dedc:${r.id}`]: 1 } : { [`fac:${r.facility}`]: 1 };
      if (oneRecipe) dedRecipes.set(r.id, r.facility);
      col[`item:${r.output.item}`] = r.output.qty * cycles;
      if (r.byproduct) col[`item:${r.byproduct.item}`] = (col[`item:${r.byproduct.item}`] ?? 0) + r.byproduct.qty * cycles;
      for (const i of r.inputs) col[`item:${i.item}`] = (col[`item:${i.item}`] ?? 0) - i.qty * cycles;
      col[rate > 1 ? 'pfast' : 'pslow'] = ePower * rate;
      variables[key] = col;
      meta.set(key, { recipe: r, covered: false, cycleSeconds: seconds, workerLevel: null, personalityBonus: false, perUnit: r.output.qty * cycles, electric: true });
    }
    const tiers = workerTiers(r, o.workers);
    if (!tiers) {
      if (!eSeconds) blockers.add(`${r.ability}:${r.abilityLevel}`);
      continue;
    }
    // Travail aux champs : chaque récolte demande des tâches (défricher, semer, arroser, récolter)
    // faites par n'importe quel Aniimo de la capacité. Quelques secondes par récolte, mais il faut
    // au moins un Aniimo de chaque capacité.
    const jobs = r.kind === 'grower' ? [...(r.steps ?? []), ...(o.watering ? [{ ability: 'water' as AbilityId, level: 1, workload: 6 }] : [])] : [];
    const missing = jobs.find((j) => !(o.workers.byAbility[j.ability] ?? []).some((w) => w.level >= j.level));
    if (missing) {
      blockers.add(`${missing.ability}:${missing.level}`);
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
      // Calcul exact : une machine compte pour sa recette (ded:…), pas pour chaque variante.
      const oneRecipe = o.exact && r.kind === 'processor' && !TURN_TAKING.has(r.facility);
      const col: Record<string, number> = oneRecipe ? { [`dedc:${r.id}`]: 1 } : { [`fac:${r.facility}`]: 1 };
      if (oneRecipe) dedRecipes.set(r.id, r.facility);
      if (o.exact && r.kind === 'grower') ints[key] = 1; // parcelles entières
      col[`item:${r.output.item}`] = (col[`item:${r.output.item}`] ?? 0) + r.output.qty * cycles;
      if (r.byproduct) col[`item:${r.byproduct.item}`] = (col[`item:${r.byproduct.item}`] ?? 0) + r.byproduct.qty * cycles;
      for (const i of r.inputs) col[`item:${i.item}`] = (col[`item:${i.item}`] ?? 0) - i.qty * cycles;
      if (r.seedCost) {
        col.coins = -r.seedCost * cycles;
        col.profit = -r.seedCost * cycles;
      }
      if (r.seedWheat) col.wheat = r.seedWheat * cycles;
      // Parcelle couverte : elle prend une place du type voulu dans les zones de ce climat.
      if (v.covered && r.environment) col[`env:${r.environment}:${PLOT_KIND[r.facility] ?? 'big'}`] = 1;
      for (const j of jobs) {
        const busy = j.workload / seconds; // Aniimo occupés en moyenne par exemplaire
        col[`ab:${j.ability}:1`] = (col[`ab:${j.ability}:1`] ?? 0) + busy;
        col.workers = (col.workers ?? 0) + busy;
      }
      if (r.kind !== 'grower' && r.ability) {
        if (dedicated) {
          // Le temps passé sur cette recette doit être couvert par un Aniimo posté à l'installation.
          const st = `st:${r.facility}:${w.level}:${w.bonus ? 1 : 0}`;
          col[st] = 1;
          staffTiers.set(st, { facility: r.facility, ability: r.ability, level: w.level, bonus: w.bonus, letter });
        } else {
          // Un Aniimo de niveau ≥ w.level (et de la bonne lettre si bonus) est occupé par exemplaire.
          col.workers = 1;
          for (let l = 1; l <= w.level; l++) {
            col[`ab:${r.ability}:${l}`] = 1;
            if (w.bonus) col[`pb:${r.ability}:${letter}:${l}`] = 1;
          }
        }
      }
      variables[key] = col;
      meta.set(key, { recipe: r, covered: v.covered, cycleSeconds: seconds, workerLevel: r.kind === 'grower' ? null : w.level, personalityBonus: w.bonus, perUnit: r.output.qty * cycles });
    }
  }

  // Ventes.
  for (const [id, it] of Object.entries(HOMELAND.items)) {
    if (it.currency === 'coins' && it.sellValue > 0) {
      variables[`sell:${id}`] = { [`item:${id}`]: -1, coins: it.sellValue, profit: it.sellValue };
      if (o.season && it.points) variables[`sell:${id}`].points = it.points;
    }
  }

  // Gamelle : feed:plat = plats donnés par heure, pris sur la production (donc plus vendus).
  const feeding = o.feeding !== false;
  if (feeding) {
    for (const [id, value] of Object.entries(HOMELAND.food ?? {})) {
      if (HOMELAND.items[id] && value > 0) variables[`feed:${id}`] = { [`item:${id}`]: -1, food: value };
    }
  }

  // Contraintes : installations, climat, ouvriers, bilans.
  for (const [id, f] of Object.entries(o.setup.facilities)) if (f.count > 0) constraints[`fac:${id}`] = { max: f.count };
  // Machines dédiées : ded:recette (entier) machines pour cette recette, qui couvrent le temps de
  // toutes ses variantes.
  for (const [id, facility] of dedRecipes) {
    variables[`ded:${id}`] = { [`dedc:${id}`]: -1, [`fac:${facility}`]: 1 };
    ints[`ded:${id}`] = 1;
    constraints[`dedc:${id}`] = { max: 0 };
  }
  // Climat : chaque appareil est réglé sur un seul mode (une Fournaise thermique fait Chaud OU Brûlant) ;
  // mode:appareil:climat = appareils réglés ainsi (entier). Autour de chacun, un mélange de
  // parcelles parmi les placements optimaux précalculés (lay:climat:k, combinaison convexe).
  for (const [env, b] of Object.entries(ENV_BUILDING)) {
    const count = o.setup.facilities[b]?.count ?? 0;
    for (const kind of ['farmland', 'woodland', 'big'] as PlotKind[]) constraints[`env:${env}:${kind}`] = { max: 0 };
    if (count <= 0) continue;
    constraints[`dev:${b}`] = { max: count };
    constraints[`zones:${env}`] = { max: 0 };
    // L'appareil occupe un Aniimo de la capacité voulue (niveau 1 suffit) à plein temps.
    variables[`mode:${b}:${env}`] = { [`zones:${env}`]: -1, [`dev:${b}`]: 1, workers: 1, [`ab:${ENV_STAFF[b]}:1`]: 1 };
    ints[`mode:${b}:${env}`] = 1;
    layoutsFor(b).forEach((l, k) => {
      variables[`lay:${env}:${k}`] = { [`zones:${env}`]: 1, [`env:${env}:farmland`]: -l.farmland, [`env:${env}:woodland`]: -l.woodland, [`env:${env}:big`]: -l.big };
    });
  }
  // Paires Fournaise + Climatisation aux zones chevauchantes (3 climats pour 2 appareils) :
  // pair:c = paires ainsi réglées (entier, chacune prend une Fournaise et une Climatisation et
  // leurs deux Aniimo) ; plays:c:k = placements précalculés, en combinaison convexe.
  if (o.pairs === true && (o.setup.facilities['heat-furnace']?.count ?? 0) > 0 && (o.setup.facilities['cooling-unit']?.count ?? 0) > 0) {
    PAIR_COMBOS.forEach((c, ci) => {
      variables[`pair:${ci}`] = { [`pz:${ci}`]: -1, 'dev:heat-furnace': 1, 'dev:cooling-unit': 1, workers: 2, 'ab:fire:1': 1, 'ab:ice:1': 1 };
      ints[`pair:${ci}`] = 1;
      constraints[`pz:${ci}`] = { max: 0 };
      const envs = [c.heat, c.both, c.cool];
      PAIR_LAYOUTS.forEach((l, k) => {
        const col: Record<string, number> = { [`pz:${ci}`]: 1 };
        envs.forEach((env, z) => PAIR_KINDS.forEach((kind, t) => {
          if (l.counts[z][t]) col[`env:${env}:${kind}`] = (col[`env:${env}:${kind}`] ?? 0) - l.counts[z][t];
        }));
        variables[`plays:${ci}:${k}`] = col;
      });
    });
  }
  // Aniimo postés (nombre entier par installation et par niveau) : ils occupent un ouvrier entier.
  for (const [st, t] of staffTiers) {
    const col: Record<string, number> = { [st]: -1, [`staff:${t.facility}`]: 1, workers: 1 };
    for (let l = 1; l <= t.level; l++) {
      col[`ab:${t.ability}:${l}`] = 1;
      if (t.bonus) col[`pb:${t.ability}:${t.letter}:${l}`] = 1;
    }
    variables[`s:${st}`] = col;
    ints[`s:${st}`] = 1;
    constraints[st] = { max: 0 };
    constraints[`staff:${t.facility}`] = { max: o.setup.facilities[t.facility]?.count ?? 0 };
  }
  const team = o.workers.team;
  // Tous les Aniimo installés au logis mangent, qu'ils travaillent ou non.
  if (feeding) constraints.food = { min: team ? 0 : FOOD_PER_HOUR * o.workers.total };
  if (!team) {
    constraints.workers = { max: o.workers.total };
    for (const [a, list] of Object.entries(o.workers.byAbility)) {
      for (let l = 1; l <= 4; l++) {
        const able = list!.filter((w) => w.level >= l);
        constraints[`ab:${a}:${l}`] = { max: able.length };
        for (const x of 'IENSFTPJ') constraints[`pb:${a}:${x}:${l}`] = { max: able.filter((w) => w.personality?.includes(x)).length };
      }
    }
  } else {
    // y:p = Aniimo recrutés du profil p (entier) ; w:p:a = ceux affectés à un poste de capacité a.
    // Les postes demandant le niveau ≥ T sont couverts par des affectations de niveau ≥ T.
    for (const [a] of Object.entries(o.workers.byAbility)) for (let l = 1; l <= 4; l++) constraints[`ab:${a}:${l}`] = { max: 0 };
    constraints.team = { max: team.cap };
    for (const a of team.mustHave) constraints[`need:${a}`] = { min: 1 };
    for (const p of team.profiles) {
      // y:p = recrues, k:p = Aniimo déjà au logis gardés (au plus `owned`).
      // Coût symbolique d'1 pièce/h par Aniimo : à rythme égal, la plus petite équipe l'emporte.
      const base: Record<string, number> = { team: 1, [`asg:${p.key}`]: -1, profit: -1 };
      if (feeding) base.food = -FOOD_PER_HOUR;
      for (const a of Object.keys(p.homeland)) base[`need:${a}`] = 1;
      variables[`y:${p.key}`] = { ...base, recruits: 1 };
      if (p.owned) {
        variables[`k:${p.key}`] = { ...base, [`own:${p.key}`]: 1 };
        constraints[`own:${p.key}`] = { max: p.owned };
      }
      // Relaxation continue : les nombres entiers sont retrouvés ensuite (voir team.ts), le calcul exact en entiers étant trop lent.
      constraints[`asg:${p.key}`] = { max: 0 };
      for (const [a, lvl] of Object.entries(p.homeland) as [AbilityId, number][]) {
        const w: Record<string, number> = { [`asg:${p.key}`]: 1 };
        for (let l = 1; l <= lvl; l++) w[`ab:${a}:${l}`] = -1;
        variables[`w:${p.key}:${a}`] = w;
      }
    }
  }
  // Capacité absente de l'équipe : aucun poste de cette capacité (appareils climatiques compris).
  for (const a of Object.values(ENV_STAFF)) constraints[`ab:${a}:1`] ??= { max: 0 };
  // Générateur crépitant : gen = générateurs en service (entier, 1 au plus), chacun tenu par un Aniimo Foudre du niveau voulu.
  // Un Aniimo Foudre de niveau inférieur au niveau demandé fait tourner le générateur à puissance
  // réduite (estimation : la puissance du niveau de générateur qu'il suffirait à tenir).
  // Taux d'alimentation = production ÷ consommation, plafonné à 120 % (relevé en jeu : 600 W pour
  // 210 W consommés → 120 %). Le générateur sert l'un des deux régimes : gen:l (réseau chargé,
  // vitesse normale) ou gen:l+ (consommation ≤ production ÷ 1,2, installations 20 % plus rapides).
  if (generator && Object.values(variables).some((v) => 'pslow' in v)) {
    for (let l = 1; l <= generator.lightning; l++) {
      const power = generatorPower(generator.level, l);
      if (!power) continue;
      for (const fast of [false, true]) {
        const key = `gen:${l}${fast ? '+' : ''}`;
        const col: Record<string, number> = { [fast ? 'pfast' : 'pslow']: -power, gens: 1, workers: 1 };
        for (let k = 1; k <= l; k++) col[`ab:lightning:${k}`] = 1;
        variables[key] = col;
        ints[key] = 1;
      }
      constraints[`ab:lightning:${l}`] ??= { max: 0 };
    }
    constraints.gens = { max: 1 };
    constraints.pslow = { max: 0 };
    constraints.pfast = { max: 0 };
  }
  const itemKeys = new Set(Object.values(variables).flatMap((c) => Object.keys(c).filter((k) => k.startsWith('item:'))));
  for (const k of itemKeys) constraints[k] = { min: 0 };
  constraints.coins = { min: 0 };
  if (o.season?.wheatPerDay != null) constraints.wheat = { max: o.season.wheatPerDay / 24 };

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
      const r1 = solveLP({ optimize: 't', opType: 'max', constraints, variables, ints });
      const best = r1.feasible ? r1.t ?? 0 : 0;
      if (best <= 1e-9) return emptyPlan(target, remaining, [...blockers], o);
      hours = 1 / best;
      // Passe 2 : à 99,9 % de cette vitesse, un maximum de pièces en plus.
      constraints.tmin = { min: best * 0.999 };
      variables.t = { ...t, tmin: 1 };
    }
  }
  if (o.goal.kind === 'points' && o.season) {
    // Passe 1 bis : un maximum de points de l'événement, puis (passe 2) un maximum de pièces à 99,9 %.
    const r1 = solveLP({ optimize: 'points', opType: 'max', constraints, variables, ints });
    const best = r1.feasible ? r1.result : 0;
    if (best > 1e-9) {
      constraints.pointsmin = { min: best * 0.999 };
      for (const v of Object.values(variables)) if ('points' in v) v.pointsmin = v.points;
    }
  }
  const r2 = solveLP({ optimize: 'profit', opType: 'max', constraints, variables, ints });
  if (!r2.feasible) return emptyPlan(target, remaining, [...blockers], o);
  solution = r2;
  if (team?.profiles.some((p) => p.owned)) {
    // Passe 3 : au même rythme (et presque autant de pièces), le moins de recrues possible,
    // pour changer au minimum l'équipe du joueur.
    constraints.profitmin = { min: r2.result - Math.abs(r2.result) * 0.002 };
    for (const v of Object.values(variables)) if ('profit' in v) v.profitmin = v.profit;
    const r3 = solveLP({ optimize: 'recruits', opType: 'min', constraints, variables, ints });
    if (r3.feasible) solution = r3;
  }

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
  const staffing: NonNullable<Plan['staffing']> = [];
  if (dedicated) {
    for (const [st, t] of staffTiers) {
      const count = Math.round(solution[`s:${st}`] ?? 0);
      if (count <= 0) continue;
      staffing.push({ facility: t.facility, ability: t.ability, level: t.level, bonus: t.bonus, count });
      workersUsed[t.ability] = (workersUsed[t.ability] ?? 0) + count;
    }
  } else {
    for (const r of rows) if (r.recipe.ability && r.recipe.kind !== 'grower' && !r.electric) workersUsed[r.recipe.ability] = (workersUsed[r.recipe.ability] ?? 0) + r.units;
  }

  const climate = Object.entries(ENV_BUILDING).flatMap(([env, device]) => {
    const zones = Math.round(solution[`mode:${device}:${env}`] ?? 0);
    const plots = rows.filter((r) => r.covered && r.recipe.environment === env).reduce((n, r) => n + r.units, 0);
    return zones > 0 && plots > 1e-4 ? [{ device, env: env as Environment, zones, plots }] : [];
  });

  const pairs = PAIR_COMBOS.map((c, ci) => ({ ...c, count: Math.round(solution[`pair:${ci}`] ?? 0) })).filter((p) => p.count > 0);
  for (const c of climate) workersUsed[ENV_STAFF[c.device]] = (workersUsed[ENV_STAFF[c.device]] ?? 0) + c.zones;
  for (const p of pairs) {
    workersUsed.fire = (workersUsed.fire ?? 0) + p.count;
    workersUsed.ice = (workersUsed.ice ?? 0) + p.count;
  }

  const dishes = Object.entries(solution)
    .filter(([k, v]) => k.startsWith('feed:') && v > 1e-6)
    .map(([k, v]) => ({ item: k.slice(5), perHour: v }))
    .sort((a, b) => b.perHour - a.perHour);
  const eaters = team ? team.profiles.reduce((n, p) => n + (solution[`y:${p.key}`] ?? 0) + (solution[`k:${p.key}`] ?? 0), 0) : o.workers.total;
  const food = feeding ? { eaters, perHour: FOOD_PER_HOUR * eaters, dishes } : undefined;

  const genOn = (l: number) => Math.round((solution[`gen:${l}`] ?? 0) + (solution[`gen:${l}+`] ?? 0)) > 0;
  const genLevel = generator ? [...Array(generator.lightning).keys()].map((i) => i + 1).find(genOn) : undefined;
  const genFast = genLevel != null && Math.round(solution[`gen:${genLevel}+`] ?? 0) > 0;
  const generators = genLevel ? 1 : 0;
  if (generators > 0) workersUsed.lightning = (workersUsed.lightning ?? 0) + generators;
  const electric = generator && genLevel
    ? { generators, level: generator.level, lightning: genLevel, rate: genFast ? ELECTRIC_BONUS : 1, power: generatorPower(generator.level, genLevel), used: rows.filter((r) => r.electric).reduce((s, r) => s + r.units * (HOMELAND.levels[r.recipe.facility]?.[(o.setup.facilities[r.recipe.facility]?.level ?? 0) - 1]?.power ?? 0), 0) }
    : undefined;
  const season = o.season
    ? {
        pointsPerHour: sales.reduce((s, x) => s + x.perHour * (HOMELAND.items[x.item].points ?? 0), 0),
        wheatPerHour: rows.reduce((s, r) => s + (r.recipe.seedWheat ?? 0) * (3600 / r.cycleSeconds) * r.units, 0),
      }
    : undefined;

  const teamOut = team
    ? team.profiles.map((p) => ({ key: p.key, count: (solution[`y:${p.key}`] ?? 0) + (solution[`k:${p.key}`] ?? 0) })).filter((x) => x.count > 1e-6)
    : undefined;

  return { feasible: true, hours, coinsPerHour, rows, sales, stockPerHour, target, remaining, facilityUse, workersUsed, blockers: [...blockers], climate, pairs, machines: o.exact ? machinesOf(rows, dedRecipes) : undefined, team: teamOut, staffing: dedicated ? staffing : undefined, food, season, electric };
}

/**
 * Machines dédiées par recette : le temps occupé par la recette (toutes variantes), arrondi au-dessus.
 * Le calcul exact garantit qu'il en faut au plus autant que le solveur en a réservé.
 */
function machinesOf(rows: PlanRow[], dedicated: Map<string, string>): Record<string, number> {
  const busy: Record<string, number> = {};
  for (const r of rows) if (dedicated.has(r.recipe.id)) busy[r.recipe.id] = (busy[r.recipe.id] ?? 0) + r.units;
  return Object.fromEntries(Object.entries(busy).map(([id, u]) => [id, Math.max(1, Math.ceil(u - 1e-6))]));
}

function emptyPlan(target: Plan['target'], remaining: Plan['remaining'], blockers: string[], o: PlanOptions): Plan {
  return {
    feasible: false, hours: null, coinsPerHour: 0, rows: [], sales: [], stockPerHour: {}, target, remaining,
    facilityUse: Object.entries(o.setup.facilities).filter(([, f]) => f.count > 0).map(([id, f]) => ({ facility: id, count: f.count, used: 0 })),
    workersUsed: {}, blockers, climate: [], pairs: [],
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
export function roadmap(from: number, workers: (rv: number) => WorkerPool, opts: Pick<PlanOptions, 'watering' | 'includeUnverified' | 'dedicated'>): RoadmapStep[] {
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
