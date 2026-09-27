import { describe, expect, it } from 'vitest';
import { ANIIMO, ANIIMO_BY_ID } from '../../data/aniimo';
import { candidateProfiles, rankRecruits } from './recruit';
import { MAX_ANIIMO_BY_RV } from '../rv';
import ex from '../../data/exemple-rv8.gen.json';

const roster = ex.ouvriers.map((o) => ({ homeland: ANIIMO_BY_ID.get(o.aniimo)!.homeland, personality: o.personnalite }));

describe('qui recruter (profil réel RV 8)', () => {
  const result = rankRecruits({
    rv: 8,
    roster,
    candidates: candidateProfiles(ANIIMO, false),
    stock: { coins: 40001, items: ex.stock },
    maxAniimo: MAX_ANIIMO_BY_RV[8],
    shinies: ex.eclatants,
    opts: { watering: true, includeUnverified: false },
  });

  it('au RV 9 (5 mines), un 5e Aniimo Terre 3 est le meilleur ajout', () => {
    const top = result.scores[0];
    expect(top.candidate.homeland.earth).toBe(3);
    expect(top.next).toBeGreaterThan(1);
  });

  it('les gains avec la bonne personnalité ne sont jamais inférieurs', () => {
    for (const s of result.scores) {
      expect(s.nowBest).toBeGreaterThanOrEqual(s.now - 1e-9);
      expect(s.nextBest).toBeGreaterThanOrEqual(s.next - 1e-9);
    }
  });

  it('le logis est plein (22 + 2 éclatants = 24) et propose qui retirer', () => {
    expect(result.full).toBe(true);
    expect(result.removals).toHaveLength(roster.length);
    expect(result.removals[0].loss).toBeLessThanOrEqual(result.removals.at(-1)!.loss);
  });
}, 60000);
