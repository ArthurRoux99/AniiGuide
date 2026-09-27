import { describe, expect, it } from 'vitest';
import { ANIIMO, ANIIMO_BY_ID } from '../../data/aniimo';
import { candidateProfiles } from './recruit';
import { MUST_HAVE, diffTeam, optimalTeam } from './team';
import { plan, rosterPool, setupForRv } from './optimize';
import { MAX_ANIIMO_BY_RV } from '../rv';
import ex from '../../data/exemple-rv8.gen.json';

const opts = { watering: true, includeUnverified: false };
const zero = { coins: 0, items: {} };
const current = ex.ouvriers.map((o) => ({ homeland: ANIIMO_BY_ID.get(o.aniimo)!.homeland, personality: null }));

describe('équipe optimale', () => {
  for (const rv of [5, 9, 16]) {
    it(`RV ${rv} : tient dans le logis, couvre les champs, et vaut au moins l'équipe actuelle`, () => {
      const cap = MAX_ANIIMO_BY_RV[rv] - 2;
      const t = optimalTeam({ rv, candidates: candidateProfiles(ANIIMO, false), cap, personality: false, stock: zero, opts });
      expect(t.size).toBeLessThanOrEqual(cap);
      for (const a of MUST_HAVE) expect(t.members.some((m) => m.candidate.homeland[a])).toBe(true);
      expect(t.plan.hours).not.toBeNull();
      // L'équipe entière arrondie atteint la borne idéale (à 1 % près).
      expect(t.plan.hours!).toBeLessThanOrEqual(t.boundHours! * 1.01);
      const mine = plan({ ...opts, setup: setupForRv(rv), workers: rosterPool(current), goal: { kind: 'levelUp', stock: zero } });
      expect(t.plan.hours!).toBeLessThanOrEqual(mine.hours! + 1e-6);
    });
  }

  it('au RV 16, l’équipe actuelle est bien plus lente que l’équipe optimale', () => {
    const t = optimalTeam({ rv: 16, candidates: candidateProfiles(ANIIMO, false), cap: MAX_ANIIMO_BY_RV[16] - 2, personality: false, stock: zero, opts });
    const mine = plan({ ...opts, setup: setupForRv(16), workers: rosterPool(current), goal: { kind: 'levelUp', stock: zero } });
    expect(mine.hours! / t.plan.hours!).toBeGreaterThan(1.3);
  });

  it('diffTeam : garder + libérer = équipe actuelle, garder + recruter = équipe cible', () => {
    const t = optimalTeam({ rv: 9, candidates: candidateProfiles(ANIIMO, false), cap: 24, personality: false, stock: zero, opts });
    const d = diffTeam(current, t.members);
    const kept = d.keep.reduce((s, k) => s + k.count, 0);
    expect(kept + d.release.length).toBe(current.length);
    expect(kept + d.recruit.reduce((s, k) => s + k.count, 0)).toBe(t.size);
  });
});

describe('garder son équipe', () => {
  it('RV 9 : même rythme que l’équipe libre, avec moins de recrues', () => {
    const base = { rv: 9, candidates: candidateProfiles(ANIIMO, false), cap: 22, personality: false, stock: zero, opts };
    const free = optimalTeam(base);
    const kept = optimalTeam({ ...base, current });
    expect(kept.plan.hours!).toBeLessThanOrEqual(free.plan.hours! * 1.01);
    const recruits = (m: typeof kept.members) => diffTeam(current, m).recruit.reduce((s, k) => s + k.count, 0);
    expect(recruits(kept.members)).toBeLessThan(recruits(free.members));
  });
});
