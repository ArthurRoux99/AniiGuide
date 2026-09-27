import type { AbilityId, AbilityLevels } from '../abilities';
import { plan, rosterPool, setupForRv, teamPool, type Plan, type PlanOptions } from './optimize';
import type { RecruitCandidate } from './recruit';

// Équipe optimale pour un niveau de Camping-car : l'optimiseur choisit en même temps la production
// et les Aniimo (programme linéaire, voir teamPool), puis on arrondit à une vraie équipe en nombres
// entiers et on la vérifie avec le calcul exact, Aniimo par Aniimo.

/** Capacités indispensables : travail aux champs (défricher, semer, arroser, récolter) et transport. */
export const MUST_HAVE: AbilityId[] = ['grass', 'dark', 'earth', 'water', 'hauling'];

export interface TeamInput {
  rv: number;
  candidates: RecruitCandidate[];
  /** Places disponibles (maximum du logis moins les éclatants). */
  cap: number;
  /** Suppose que chaque Aniimo a la bonne personnalité pour son poste. */
  personality: boolean;
  stock: { coins: number; items: Record<string, number> };
  opts: Pick<PlanOptions, 'watering' | 'includeUnverified' | 'dedicated'>;
  /** Équipe actuelle : à rythme égal, l'optimiseur la garde au maximum. */
  current?: { homeland: AbilityLevels }[];
}

export interface TeamMember {
  candidate: RecruitCandidate;
  count: number;
}

export interface TeamResult {
  members: TeamMember[];
  /** Plan exact de l'équipe arrondie. */
  plan: Plan;
  /** Borne idéale (équipe fractionnaire) : l'équipe réelle s'en approche au mieux. */
  boundHours: number | null;
  size: number;
}

const keyOf = (h: AbilityLevels) => JSON.stringify(Object.entries(h).sort());

export function optimalTeam(input: TeamInput): TeamResult {
  const { rv, cap, personality, stock, opts } = input;
  const owned = new Map<string, number>();
  for (const w of input.current ?? []) owned.set(keyOf(w.homeland), (owned.get(keyOf(w.homeland)) ?? 0) + 1);
  const byKey = new Map(input.candidates.map((c) => [keyOf(c.homeland), c]));
  // Un Aniimo déjà au logis reste proposable même hors de la liste (ex. prismana exclus).
  for (const w of input.current ?? []) if (!byKey.has(keyOf(w.homeland))) byKey.set(keyOf(w.homeland), { ids: [], homeland: w.homeland });
  const candidates = [...byKey.values()];
  const goal = rv < 20 ? ({ kind: 'levelUp', stock } as const) : ({ kind: 'coins' } as const);
  const relaxed = plan({
    ...opts,
    setup: setupForRv(rv),
    goal,
    workers: teamPool({ profiles: candidates.map((c) => ({ key: keyOf(c.homeland), homeland: c.homeland, owned: owned.get(keyOf(c.homeland)) })), cap, personality, mustHave: MUST_HAVE }),
  });

  // Arrondi : la partie entière de chaque profil, puis une place de plus pour les parts restantes,
  // de la plus grande à la plus petite, tant qu'il reste de la place.
  const fractional = (relaxed.team ?? []).map((t) => ({ key: t.key, y: t.count }));
  const counts = new Map(fractional.map((t) => [t.key, Math.floor(t.y + 1e-6)]));
  let used = [...counts.values()].reduce((a, b) => a + b, 0);
  for (const t of [...fractional].sort((a, b) => b.y - Math.floor(b.y + 1e-6) - (a.y - Math.floor(a.y + 1e-6)))) {
    if (used >= cap) break;
    if (t.y - Math.floor(t.y + 1e-6) > 0.02) {
      counts.set(t.key, counts.get(t.key)! + 1);
      used++;
    }
  }
  // Chaque capacité indispensable doit être présente.
  for (const a of MUST_HAVE) {
    const has = [...counts.entries()].some(([k, n]) => n > 0 && byKey.get(k)!.homeland[a]);
    if (has || used >= cap) continue;
    const best = candidates.filter((c) => c.homeland[a]).sort((x, y) => (y.homeland[a] ?? 0) - (x.homeland[a] ?? 0) || Object.keys(y.homeland).length - Object.keys(x.homeland).length)[0];
    if (best) {
      const k = keyOf(best.homeland);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      used++;
    }
  }

  const members = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .map(([k, count]) => ({ candidate: byKey.get(k)!, count }))
    .sort((a, b) => b.count - a.count);
  const roster = members.flatMap((m) => Array.from({ length: m.count }, () => ({ homeland: m.candidate.homeland, personality: personality ? 'IENSFTPJ' : null })));
  const exact = plan({ ...opts, setup: setupForRv(rv), goal, workers: rosterPool(roster) });

  return { members, plan: exact, boundHours: relaxed.hours, size: roster.length };
}

export interface TeamDiff {
  keep: { candidate: RecruitCandidate; count: number }[];
  recruit: { candidate: RecruitCandidate; count: number }[];
  /** Index des ouvriers actuels à libérer. */
  release: number[];
}

/** Ce qu'il faut garder, recruter et libérer pour passer de l'équipe actuelle à l'équipe optimale. */
export function diffTeam(current: { homeland: AbilityLevels }[], target: TeamMember[]): TeamDiff {
  const want = new Map(target.map((m) => [keyOf(m.candidate.homeland), { ...m }]));
  const keep = new Map<string, { candidate: RecruitCandidate; count: number }>();
  const release: number[] = [];
  current.forEach((w, i) => {
    const k = keyOf(w.homeland);
    const m = want.get(k);
    if (m && m.count > 0) {
      m.count--;
      const kept = keep.get(k) ?? { candidate: m.candidate, count: 0 };
      kept.count++;
      keep.set(k, kept);
    } else release.push(i);
  });
  return { keep: [...keep.values()], recruit: [...want.values()].filter((m) => m.count > 0), release };
}
