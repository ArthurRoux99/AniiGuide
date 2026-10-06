import { describe, expect, it } from 'vitest';
import { idealPool, plan, setupWithOverrides } from './optimize';
import { autonomy } from './autonomy';
import { HOMELAND } from '../../data/homeland';

const opts = (setup: ReturnType<typeof setupWithOverrides>) => ({ setup, workers: idealPool(24), goal: { kind: 'levelUp', stock: { coins: 0, items: {} } } as const, watering: true, includeUnverified: false });

describe('quand revenir', () => {
  it('chaque production : stock du niveau ÷ production horaire, du plus court au plus long', () => {
    const setup = setupWithOverrides(10, {});
    const list = autonomy(plan(opts(setup)), setup);
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) expect(list[i].hours).toBeGreaterThanOrEqual(list[i - 1].hours);
    for (const a of list) {
      expect(a.stock).toBe(HOMELAND.levels[a.facility][setup.facilities[a.facility].level - 1].stock);
      expect(a.hours).toBeCloseTo(a.stock / a.perHour);
    }
  });

  it('une Ferme moins améliorée se remplit plus vite', () => {
    const hi = setupWithOverrides(10, {});
    const lo = setupWithOverrides(10, { farmland: { count: hi.facilities.farmland.count, level: 1 } });
    const farm = (s: typeof hi) => autonomy(plan(opts(s)), s).filter((a) => a.facility === 'farmland');
    const a = farm(hi), b = farm(lo);
    expect(b.length).toBeGreaterThan(0);
    expect(Math.min(...b.map((x) => x.hours))).toBeLessThan(Math.min(...a.map((x) => x.hours)));
  });
});
