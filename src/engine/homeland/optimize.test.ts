import { describe, expect, it } from 'vitest';
import { HOMELAND } from '../../data/homeland';
import { idealPool, plan, roadmap, rosterPool, setupForRv, wholeUnits } from './optimize';
import { MAX_ANIIMO_BY_RV } from '../rv';

const base = { watering: true, includeUnverified: false };

describe('setupForRv', () => {
  it('correspond aux conditions vues en jeu pour le passage au RV 9 (18 fermes, 9 pépinières, 2 puits)', () => {
    const s = setupForRv(8);
    expect(s.facilities.farmland.count).toBe(18);
    expect(s.facilities.woodland.count).toBe(9);
    expect(s.facilities.well.count).toBe(2);
  });

  it('coût du RV 9 conforme à l’écran du Camping-car', () => {
    expect(HOMELAND.levelUp['9']).toEqual({ coins: 260000, items: { rough_lumber: 1520, coarse_sifted_ore: 800 } });
  });
});

describe('plan', () => {
  const stock = { coins: 40001, items: { rough_lumber: 1767, coarse_sifted_ore: 1838 } };

  it('RV 8 → 9 : faisable, ne dépasse pas les installations ni les ouvriers', () => {
    const p = plan({ ...base, setup: setupForRv(8), workers: idealPool(24), goal: { kind: 'levelUp', stock } });
    expect(p.feasible).toBe(true);
    expect(p.hours).toBeGreaterThan(0);
    for (const f of p.facilityUse) expect(f.used).toBeLessThanOrEqual(f.count + 1e-6);
    // Matériaux déjà réunis : il ne reste que les pièces.
    expect(p.remaining).toEqual({ coins: 260000 - 40001, items: { rough_lumber: 0, coarse_sifted_ore: 0 } });
    expect(p.hours! * p.coinsPerHour).toBeGreaterThanOrEqual(260000 - 40001 - 1);
  });

  it('sans personnalité, le même logis est plus lent qu’avec les bonnes personnalités', () => {
    const w = (bonus: boolean) =>
      rosterPool(Array.from({ length: 24 }, () => ({ homeland: { fire: 3, grass: 3, water: 3, earth: 3, wind: 3, dark: 3, artisanship: 3, leisure: 3, perfumery: 3, lightning: 3, hauling: 3 }, personality: bonus ? 'ESTP' : null })));
    const slow = plan({ ...base, setup: setupForRv(8), workers: w(false), goal: { kind: 'coins' } });
    const fast = plan({ ...base, setup: setupForRv(8), workers: w(true), goal: { kind: 'coins' } });
    expect(fast.coinsPerHour).toBeGreaterThan(slow.coinsPerHour);
  });

  it('arrondit les champs à des nombres entiers sans dépasser le nombre posé', () => {
    const p = plan({ ...base, setup: setupForRv(8), workers: idealPool(24), goal: { kind: 'coins' } });
    const whole = wholeUnits(p.rows);
    const farms = p.rows.filter((r) => r.recipe.facility === 'farmland').reduce((s, r) => s + whole.get(r)!, 0);
    expect(farms).toBeLessThanOrEqual(18);
  });
});

describe('roadmap', () => {
  it('chaque niveau du RV 2 au 20 est atteignable, et de plus en plus long', () => {
    const steps = roadmap(2, (rv) => idealPool(MAX_ANIIMO_BY_RV[rv]), base);
    expect(steps).toHaveLength(18);
    for (const s of steps) expect(s.hours).toBeGreaterThan(0);
    expect(steps.at(-1)!.hours!).toBeGreaterThan(steps[0].hours!);
  });
});

describe('Aniimo attitrés', () => {
  it('chaque installation travaillée utilisée a son Aniimo entier ; même rythme, plus d’Aniimo', () => {
    const goal = { kind: 'levelUp' as const, stock: { coins: 0, items: {} } };
    const mobile = plan({ ...base, dedicated: false, setup: setupForRv(8), workers: idealPool(24), goal });
    const fixed = plan({ ...base, dedicated: true, setup: setupForRv(8), workers: idealPool(24), goal });
    expect(fixed.hours!).toBeGreaterThanOrEqual(mobile.hours! - 1e-6);
    const used = new Set(fixed.rows.filter((r) => r.recipe.kind !== 'grower').map((r) => r.recipe.facility));
    const staffed = new Set(fixed.staffing!.map((s) => s.facility));
    for (const f of used) expect(staffed.has(f)).toBe(true);
    for (const s of fixed.staffing!) expect(Number.isInteger(s.count)).toBe(true);
    const total = (p: typeof fixed) => Object.values(p.workersUsed).reduce((a, b) => a + (b ?? 0), 0);
    expect(total(fixed)).toBeGreaterThan(total(mobile));
  });
});
