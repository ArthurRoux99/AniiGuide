import { describe, expect, it } from 'vitest';
import { idealPool, plan, setupForRv, wholeUnits } from './optimize';
import { checkZone, climateLayout } from './climate';
import { COVERAGE, layoutsFor, maxPlots } from './coverage';

const levelUp = { kind: 'levelUp', stock: { coins: 0, items: {} } } as const;

describe('couverture climatique', () => {
  it('un appareil couvre jusqu’à 32 Fermes ou 12 Pépinières (parcelles qui chevauchent la zone)', () => {
    for (const device of ['heat-furnace', 'cooling-unit', 'sunlamp']) {
      expect(maxPlots(device, 'farmland')).toBe(32);
      expect(maxPlots(device, 'woodland')).toBe(12);
    }
  });

  it('chaque placement précalculé est valide et correspond à ses comptes', () => {
    for (const [side, list] of Object.entries(COVERAGE.layouts))
      for (const l of list) {
        const zone = {
          device: 'x',
          env: 'Warm' as const,
          size: Number(side),
          plots: l.plots.map((p) => ({ ...p, facility: '', crop: '', size: COVERAGE.sizes[p.kind] })),
        };
        expect(checkZone(zone)).toEqual([]);
        expect(l.plots.filter((p) => p.kind === 'farmland')).toHaveLength(l.farmland);
        expect(l.plots.filter((p) => p.kind === 'woodland')).toHaveLength(l.woodland);
        expect(l.plots.filter((p) => p.kind === 'big')).toHaveLength(l.big);
      }
    expect(layoutsFor('cooling-unit').length).toBeGreaterThan(10);
  });
});

describe('climat dans le plan', () => {
  it('chaque appareil est réglé sur un seul mode, sans dépasser le nombre d’appareils', () => {
    for (const rv of [7, 9, 12, 16]) {
      const setup = setupForRv(rv);
      const p = plan({ watering: true, includeUnverified: false, setup, workers: idealPool(30), goal: levelUp });
      for (const device of ['heat-furnace', 'cooling-unit', 'sunlamp']) {
        const zones = p.climate.filter((c) => c.device === device).reduce((s, c) => s + c.zones, 0);
        expect(zones).toBeLessThanOrEqual(setup.facilities[device].count);
      }
    }
  });

  it('chaque appareil en service occupe un Aniimo de sa capacité (Feu, Glace, Lumière)', () => {
    const setup = setupForRv(14);
    const full = plan({ watering: true, includeUnverified: false, setup, workers: idealPool(30), goal: levelUp });
    expect(full.climate.length).toBeGreaterThan(0);
    // Sans aucun Aniimo Glace, le Refroidisseur reste éteint.
    const pool = idealPool(30);
    delete pool.byAbility.ice;
    const noIce = plan({ watering: true, includeUnverified: false, setup, workers: pool, goal: levelUp });
    expect(noIce.climate.filter((c) => c.device === 'cooling-unit')).toEqual([]);
    for (const c of full.climate) expect(full.workersUsed[c.device === 'heat-furnace' ? 'fire' : c.device === 'cooling-unit' ? 'ice' : 'light']).toBeGreaterThanOrEqual(c.zones);
  });

  it('le plan de placement range les parcelles couvertes à des positions valides', () => {
    for (const rv of [9, 12, 16]) {
      const p = plan({ watering: true, includeUnverified: false, setup: setupForRv(rv), workers: idealPool(30), goal: levelUp });
      const whole = wholeUnits(p.rows);
      const layout = climateLayout(p, p.rows, whole);
      const covered = p.rows.filter((r) => r.covered && r.recipe.environment).reduce((s, r) => s + (whole.get(r) ?? 0), 0);
      const placed = layout.zones.reduce((s, z) => s + z.plots.length, 0);
      const over = layout.overflow.reduce((s, o) => s + o.count, 0);
      expect(placed + over).toBe(covered);
      expect(over).toBeLessThanOrEqual(2);
      for (const z of layout.zones) expect(checkZone(z)).toEqual([]);
    }
  });
});
