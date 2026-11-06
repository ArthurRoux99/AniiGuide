import { describe, expect, it } from 'vitest';
import { chanceWithin, energyState, luckyTier, superTier, toFull, untilGuaranteed, weekStart } from './lucky';

describe('Lucky / Super Lucky', () => {
  it('paliers de la semaine', () => {
    expect(luckyTier(0)).toEqual({ p: 0.01, cap: 200 });
    expect(luckyTier(10)).toEqual({ p: 0.005, cap: 400 });
    expect(superTier(0).cap).toBe(500);
    expect(superTier(1).cap).toBe(1000);
    expect(superTier(5).cap).toBe(3000);
  });

  it('garantie et chance cumulée', () => {
    expect(untilGuaranteed(luckyTier(0), 150)).toBe(50);
    expect(chanceWithin(luckyTier(0), 150, 50)).toBe(1);
    // 87 captures : environ 58 % pour un Lucky à 1 %.
    expect(chanceWithin(luckyTier(0), 0, 87)).toBeCloseTo(0.583, 2);
  });

  it('semaine : lundi 4 h heure du serveur', () => {
    // Vendredi 6 novembre 2026 → lundi 2 novembre 4 h UTC (Europe), dimanche 1er 20 h UTC (Asie).
    const now = Date.parse('2026-11-06T10:00:00Z');
    expect(new Date(weekStart(now, 'eu')).toISOString()).toBe('2026-11-02T04:00:00.000Z');
    expect(new Date(weekStart(now, 'apac')).toISOString()).toBe('2026-11-01T20:00:00.000Z');
    expect(new Date(weekStart(now, 'am')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
    // Lundi 3 h en Europe : encore la semaine précédente.
    expect(new Date(weekStart(Date.parse('2026-11-09T03:00:00Z'), 'eu')).toISOString()).toBe('2026-11-02T04:00:00.000Z');
  });

  it('énergie prismatique', () => {
    expect(energyState(0)).toBe('Vide');
    expect(energyState(6500)).toBe('Très élevée');
    expect(toFull(0)).toEqual({ left: 10500, lucky: 35, superLucky: 7, nurture: 22 });
    expect(toFull(0, true).nurture).toBe(15);
  });
});
