import { HOMELAND } from '../../data/homeland';
import { plan, setupForRv, type PlanOptions } from './optimize';

// « Quoi améliorer en premier ? » : chaque amélioration à portée (un niveau de plus pour une
// installation, ou un exemplaire de plus) est essayée dans l'optimiseur ; on la classe par temps
// gagné vers le prochain niveau (ou pièces/h gagnées), rapporté à son coût en Pièces de logis.

export interface Opportunity {
  facility: string;
  kind: 'level' | 'count';
  /** Niveau ou nombre visé. */
  to: number;
  /** Coût en Pièces de logis (null : inconnu). */
  cost: number | null;
  /** Heures gagnées vers le prochain niveau (objectif « monter ») ou pièces/h gagnées. */
  gain: number;
  unit: 'hours' | 'coinsPerHour';
}

const costOf = (facility: string, level: number) => HOMELAND.levels[facility]?.[level - 1]?.cost ?? null;

export function opportunities(o: PlanOptions): Opportunity[] {
  const max = setupForRv(o.setup.rv).facilities;
  const measure = (setup: PlanOptions['setup']) => {
    const p = plan({ ...o, setup });
    if (!p.feasible) return null;
    return o.goal.kind === 'levelUp' && p.hours != null ? { value: -p.hours, unit: 'hours' as const } : { value: p.coinsPerHour, unit: 'coinsPerHour' as const };
  };
  const now = measure(o.setup);
  if (!now) return [];
  const out: Opportunity[] = [];
  for (const [id, cur] of Object.entries(o.setup.facilities)) {
    const top = max[id];
    if (!top || top.count === 0) continue;
    const tries: { kind: Opportunity['kind']; to: number; setup: PlanOptions['setup']; cost: number | null }[] = [];
    if (cur.count > 0 && cur.level < top.level) {
      // Améliorer tous les exemplaires d'un niveau.
      const c = costOf(id, cur.level + 1);
      tries.push({ kind: 'level', to: cur.level + 1, cost: c == null ? null : c * cur.count, setup: { ...o.setup, facilities: { ...o.setup.facilities, [id]: { ...cur, level: cur.level + 1 } } } });
    }
    if (cur.count < top.count) {
      // Poser un exemplaire de plus, amené au niveau des autres.
      const level = Math.max(1, cur.level);
      const costs = Array.from({ length: level }, (_, k) => costOf(id, k + 1));
      const cost = costs.every((x) => x != null) ? costs.reduce((s, x) => s + x!, 0) : null;
      tries.push({ kind: 'count', to: cur.count + 1, cost, setup: { ...o.setup, facilities: { ...o.setup.facilities, [id]: { count: cur.count + 1, level } } } });
    }
    for (const t of tries) {
      const m = measure(t.setup);
      if (!m) continue;
      const gain = m.value - now.value;
      if (gain > 1e-3) out.push({ facility: id, kind: t.kind, to: t.to, cost: t.cost, gain, unit: m.unit });
    }
  }
  // Le plus de gain par pièce dépensée d'abord ; les coûts inconnus après, par gain.
  return out.sort((a, b) => (a.cost != null && b.cost != null ? b.gain / Math.max(1, b.cost) - a.gain / Math.max(1, a.cost) : a.cost == null ? 1 : b.cost == null ? -1 : 0) || b.gain - a.gain);
}
