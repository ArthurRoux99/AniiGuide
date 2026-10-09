import { describe, expect, it } from 'vitest';
import { generatorAt, generatorPower, idealPool, plan, setupForRv } from './optimize';
import { HOMELAND } from '../../data/homeland';

const base = (rv: number, total: number, level: number) => ({ setup: setupForRv(rv), workers: idealPool(total, level), goal: { kind: 'levelUp', stock: { coins: 0, items: {} } } as const, watering: true, includeUnverified: false });

describe('mode électrique', () => {
  it('données du jeu : durée des lots (Bois brut 27 s) et Générateur crépitant', () => {
    expect(Object.keys(HOMELAND.emode!.seconds).length).toBeGreaterThan(150);
    expect(HOMELAND.emode!.seconds['woodworking-bench:rough_lumber']).toBe(27);
    expect(generatorAt(11)).toBeNull();
    expect(generatorAt(12)).toEqual({ level: 1, power: 600, lightning: 1 });
    expect(generatorAt(16)).toEqual({ level: 3, power: 1000, lightning: 3 });
    // Aniimo Foudre niv. 2 sur un générateur niv. 5 : la puissance du niveau 2.
    expect(generatorPower(5, 2)).toBe(800);
  });

  it('équipe de niveau 2 au RV 14 : bien plus rapide, réseau jamais dépassé', () => {
    const off = plan({ ...base(14, 22, 2), electric: false }), on = plan(base(14, 22, 2));
    expect(on.hours!).toBeLessThan(off.hours! * 0.85);
    expect(on.rows.some((r) => r.electric)).toBe(true);
    expect(on.electric!.used).toBeLessThanOrEqual(on.electric!.power * (1 + 1e-4));
    expect(on.workersUsed.lightning).toBeGreaterThanOrEqual(1);
  });

  it('taux d’alimentation : 120 % seulement si la consommation reste ≤ production ÷ 1,2', () => {
    for (const rv of [12, 14, 16]) {
      const p = plan(base(rv, 22, 2));
      if (!p.electric) continue;
      const cap = p.electric.rate > 1 ? p.electric.power / 1.2 : p.electric.power;
      expect(p.electric.used).toBeLessThanOrEqual(cap * (1 + 1e-4));
      for (const r of p.rows.filter((x) => x.electric)) expect(r.cycleSeconds).toBeCloseTo(HOMELAND.emode!.seconds[r.recipe.id] / p.electric.rate);
    }
  });

  it('avant le niveau 12 : rien en électrique', () => {
    const p = plan(base(11, 20, 2));
    expect(p.rows.some((r) => r.electric)).toBe(false);
    expect(p.electric).toBeUndefined();
  });
});
