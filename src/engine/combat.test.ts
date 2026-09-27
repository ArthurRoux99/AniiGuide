import { describe, expect, it } from 'vitest';
import { bestTeams, effectiveness, type Fighter } from './combat';

describe('table des éléments', () => {
  it('×1,6 sur une faiblesse, ×0,625 sur une résistance, multiplié sur deux éléments', () => {
    expect(effectiveness('water', ['fire'])).toBe(1.6);
    expect(effectiveness('fire', ['water'])).toBe(0.625);
    expect(effectiveness('fire', ['fire'])).toBe(0.625); // un élément résiste à lui-même
    expect(effectiveness('wind', ['dark', 'grass'])).toBeCloseTo(2.56);
    expect(effectiveness('fire', ['grass', 'water'])).toBe(1); // 1,6 × 0,625
    expect(effectiveness('wind', ['fire'])).toBe(1);
  });
});

const f = (id: string, elements: string[], roles: string[], score: number): Fighter => ({ id, species: id, elements, roles, score });
const pool = [
  f('feu-dps', ['fire'], ['dps'], 0.9),
  f('eau-dps', ['water'], ['dps'], 0.8),
  f('rupture', ['rock'], ['break'], 0.7),
  f('soutien', ['wind'], ['sup'], 0.7),
  f('soin', ['water'], ['heal'], 0.6),
  f('energie', ['grass'], ['energy'], 0.6),
  f('dps-faible', ['dark'], ['dps'], 0.2),
];

describe('bestTeams', () => {
  it('couvre les quatre rôles', () => {
    const [t] = bestTeams(pool);
    expect(t.members).toHaveLength(4);
    expect(t.missing).toEqual([]);
  });

  it("contre un ennemi Feu, choisit l'attaquant Eau", () => {
    const [t] = bestTeams(pool, { enemy: ['fire'] });
    expect(t.members.map((m) => m.id)).toContain('eau-dps');
    expect(t.members.map((m) => m.id)).not.toContain('feu-dps');
  });

  it('garde les Aniimo imposés', () => {
    const [t] = bestTeams(pool, { locked: ['dps-faible'] });
    expect(t.members.map((m) => m.id)).toContain('dps-faible');
  });
});
