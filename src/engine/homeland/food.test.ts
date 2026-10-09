import { describe, expect, it } from 'vitest';
import { FOOD_PER_HOUR, idealPool, plan, setupForRv } from './optimize';
import { HOMELAND } from '../../data/homeland';

const base = (rv: number, total: number) => ({ setup: setupForRv(rv), workers: idealPool(total), goal: { kind: 'coins' } as const, watering: true, includeUnverified: false });

describe('gamelle', () => {
  it('valeurs nourrissantes relevées (Blé 140)', () => {
    expect(HOMELAND.food.wheat).toBe(140);
    expect(Object.keys(HOMELAND.food).length).toBeGreaterThan(40);
  });

  it('les plats prélevés nourrissent tous les Aniimo du logis (10 par minute chacun)', () => {
    const p = plan(base(8, 24));
    expect(p.food!.eaters).toBe(24);
    const fed = p.food!.dishes.reduce((s, d) => s + d.perHour * HOMELAND.food[d.item], 0);
    expect(fed).toBeGreaterThanOrEqual(24 * FOOD_PER_HOUR - 1e-6);
  });

  it('nourrir coûte un peu de pièces (moins de 2 %)', () => {
    const fed = plan(base(10, 28)), free = plan({ ...base(10, 28), feeding: false });
    expect(free.food).toBeUndefined();
    expect(fed.coinsPerHour).toBeLessThan(free.coinsPerHour);
    expect(fed.coinsPerHour).toBeGreaterThan(free.coinsPerHour * 0.98);
  });
});
