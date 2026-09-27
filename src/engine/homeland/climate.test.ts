import { describe, expect, it } from 'vitest';
import { idealPool, plan, setupForRv, wholeUnits } from './optimize';
import { climateLayout } from './climate';

const levelUp = { kind: 'levelUp', stock: { coins: 0, items: {} } } as const;

describe('climat', () => {
  it('chaque appareil est réglé sur un seul mode, sans dépasser le nombre d’appareils', () => {
    for (const rv of [7, 9, 12, 16]) {
      const setup = setupForRv(rv);
      const p = plan({ watering: true, includeUnverified: false, setup, workers: idealPool(30), goal: levelUp });
      for (const device of ['heat-furnace', 'cooling-unit', 'sunlamp']) {
        const zones = p.climate.filter((c) => c.device === device).reduce((s, c) => s + c.zones, 0);
        expect(zones).toBeLessThanOrEqual(setup.facilities[device].count);
      }
      for (const c of p.climate) expect(c.fill).toBeLessThanOrEqual(c.zones + 1e-6);
    }
  });

  it('le plan de placement range toutes les cultures couvertes (4 Pépinières ou 16 Fermes par zone)', () => {
    const p = plan({ watering: true, includeUnverified: false, setup: setupForRv(12), workers: idealPool(30), goal: levelUp });
    const whole = wholeUnits(p.rows);
    const layout = climateLayout(p, p.rows, whole);
    const covered = p.rows.filter((r) => r.covered && r.recipe.environment).reduce((s, r) => s + (whole.get(r) ?? 0), 0);
    const placed = layout.zones.flatMap((z) => z.quarters).reduce((s, q) => s + (!q ? 0 : q.kind === 'woodland' ? 1 : q.crops.filter(Boolean).length), 0);
    const over = layout.overflow.reduce((s, o) => s + o.count, 0);
    expect(placed + over).toBe(covered);
    expect(over).toBeLessThanOrEqual(2);
    expect(layout.zones.length).toBeGreaterThan(0);
  });
});
