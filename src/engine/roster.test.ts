import { describe, expect, it } from 'vitest';
import { abilityDistribution } from './abilities';
import { findGaps } from './roster';
import { ANIIMO_BY_ID } from '../data/aniimo';
import example from '../data/exemple-rv8.gen.json';

const workers = example.ouvriers.map((o) => ANIIMO_BY_ID.get(o.aniimo)!.homeland);

describe('profil réel RV 8 (captures du 27/09/2026)', () => {
  it("reproduit exactement la « Distribution des capacités » affichée en jeu", () => {
    expect(abilityDistribution(workers)).toEqual({
      fire: 3,
      grass: 4,
      water: 5,
      earth: 6,
      lightning: 4,
      ice: 1,
      wind: 2,
      dark: 5,
      light: 0,
      hauling: 9,
      artisanship: 7,
      leisure: 5,
      perfumery: 2,
    });
  });

  it('signale Lumière et Glace comme manques prioritaires', () => {
    const pool = [...ANIIMO_BY_ID.values()];
    const gaps = findGaps(workers, pool);
    expect(gaps[0].ability).toBe('light');
    expect(gaps.map((g) => g.ability)).toContain('ice');
    // Lunara est le seul Aniimo non prismana avec Lumière : il doit sortir en premier.
    expect(ANIIMO_BY_ID.get(gaps[0].suggestions[0].id)?.name).toBe('Lunara');
    for (const g of gaps) for (const s of g.suggestions) expect(s.homeland[g.ability]).toBeGreaterThan(g.best);
  });
});
