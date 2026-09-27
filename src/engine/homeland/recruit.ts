import type { AbilityLevels } from '../abilities';
import { plan, rosterPool, setupForRv, type PlanOptions } from './optimize';

// « Qui recruter ? » : on ajoute tour à tour chaque profil de capacités possible à l'équipe du
// joueur et on mesure le temps gagné par l'optimiseur, au niveau actuel du Camping-car et au
// suivant. Un Aniimo attrapé a une personnalité au hasard : on donne le gain sans bonus de
// personnalité, et le gain maximal s'il a la bonne lettre.

export interface RosterMember {
  homeland: AbilityLevels;
  personality: string | null;
}

export interface RecruitCandidate {
  /** Identifiants des fiches Aniimo qui ont exactement ce profil de capacités. */
  ids: string[];
  homeland: AbilityLevels;
}

export interface RecruitInput {
  rv: number;
  roster: RosterMember[];
  candidates: RecruitCandidate[];
  stock: { coins: number; items: Record<string, number> };
  maxAniimo: number;
  shinies: number;
  opts: Pick<PlanOptions, 'watering' | 'includeUnverified'>;
}

export interface RecruitScore {
  candidate: RecruitCandidate;
  /** Heures gagnées sur le niveau actuel, puis sur le suivant (sans / avec la bonne personnalité). */
  now: number;
  next: number;
  nowBest: number;
  nextBest: number;
}

export interface RecruitResult {
  base: { now: number | null; next: number | null };
  scores: RecruitScore[];
  /** Le logis est plein : il faut libérer une place. */
  full: boolean;
  /** Perte (heures) si l'on retire chaque membre de l'équipe, du moins utile au plus utile. */
  removals: { index: number; loss: number }[];
}

const ALL_LETTERS = 'IENSFTPJ';

export function rankRecruits(input: RecruitInput, onProgress?: (done: number, total: number) => void): RecruitResult {
  const { rv, roster, stock, opts } = input;
  const levels = [
    { rv, stock },
    ...(rv + 1 < 20 ? [{ rv: rv + 1, stock: { coins: 0, items: {} } }] : []),
  ];
  const hours = (team: RosterMember[], i: number): number | null => {
    const l = levels[i];
    if (!l) return null;
    return plan({ ...opts, setup: setupForRv(l.rv), workers: rosterPool(team), goal: { kind: 'levelUp', stock: l.stock } }).hours;
  };
  const gain = (base: number | null, h: number | null) => (base != null && h != null ? Math.max(0, base - h) : 0);

  const base = { now: hours(roster, 0), next: hours(roster, 1) };
  const total = input.candidates.length + roster.length;
  let done = 0;

  const scores: RecruitScore[] = [];
  for (const c of input.candidates) {
    const plain = [...roster, { homeland: c.homeland, personality: null }];
    const best = [...roster, { homeland: c.homeland, personality: ALL_LETTERS }];
    const now = gain(base.now, hours(plain, 0));
    const next = gain(base.next, hours(plain, 1));
    // Le bonus de personnalité ne peut qu'ajouter : inutile de le calculer si le profil ne sert à rien.
    const useful = now > 1e-6 || next > 1e-6;
    scores.push({
      candidate: c,
      now,
      next,
      nowBest: useful ? gain(base.now, hours(best, 0)) : 0,
      nextBest: useful ? gain(base.next, hours(best, 1)) : 0,
    });
    onProgress?.(++done, total);
  }
  scores.sort((a, b) => b.now + b.next - (a.now + a.next) || b.nowBest + b.nextBest - (a.nowBest + a.nextBest));

  const full = roster.length + input.shinies >= input.maxAniimo;
  const removals = roster
    .map((_, index) => {
      const team = roster.filter((__, i) => i !== index);
      const loss = [0, 1].reduce((s, i) => {
        const b = i === 0 ? base.now : base.next;
        const h = hours(team, i);
        return s + (b == null ? 0 : h == null ? Infinity : Math.max(0, h - b));
      }, 0);
      onProgress?.(++done, total);
      return { index, loss };
    })
    .sort((a, b) => a.loss - b.loss);

  return { base, scores, full, removals };
}

/** Regroupe les fiches par profil de capacités identique (ex. toutes les « Terre 3 + Transport 3 »). */
export function candidateProfiles(entries: readonly { id: string; homeland: AbilityLevels; prismana: boolean }[], withPrismana: boolean): RecruitCandidate[] {
  const map = new Map<string, RecruitCandidate>();
  for (const e of entries) {
    if (e.prismana && !withPrismana) continue;
    if (!Object.keys(e.homeland).length) continue;
    const key = JSON.stringify(Object.entries(e.homeland).sort());
    const c = map.get(key) ?? { ids: [], homeland: e.homeland };
    c.ids.push(e.id);
    map.set(key, c);
  }
  return [...map.values()];
}
