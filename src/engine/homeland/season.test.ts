import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { idealPool, plan, setupForRv } from './optimize';
import { HOMELAND } from '../../data/homeland';

const base = (rv: number) => ({ setup: setupForRv(rv), workers: idealPool(30), watering: true, includeUnverified: false });
const usesSeason = (p: ReturnType<typeof plan>) => p.rows.some((r) => r.recipe.season);
const season = { notes: true, wheatPerDay: null };

describe('Nuit des Merveilles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('recettes de saison relevées (2 cultures, 9 plats dont 7 à Note de recette)', () => {
    const recipes = HOMELAND.recipes.filter((r) => r.season);
    expect(recipes).toHaveLength(11);
    expect(recipes.filter((r) => r.kind === 'grower').every((r) => r.level === 5 && r.environment === 'Adequate' && r.seedWheat === 4)).toBe(true);
    expect(HOMELAND.season.recipeNotes).toHaveLength(7);
    expect(HOMELAND.items.honey_glazed_pumpkin_cup.sellValue).toBe(4430);
    // Soupe : 8 Citrouilles magiques (le mode Aniimo de Wikily oublie le ×8).
    expect(HOMELAND.recipes.find((r) => r.output.item === 'golden_lantern_pumpkin_soup')!.inputs).toContainEqual({ item: 'magic_pumpkin', qty: 8 });
  });

  it('sans la saison, avant le niveau 10, ou après sa fin : aucune recette de saison', () => {
    expect(usesSeason(plan({ ...base(12), goal: { kind: 'coins' } }))).toBe(false);
    expect(usesSeason(plan({ ...base(9), goal: { kind: 'coins' }, season }))).toBe(false);
    vi.setSystemTime(new Date('2026-12-10T00:00:00Z'));
    expect(usesSeason(plan({ ...base(14), goal: { kind: 'coins' }, season }))).toBe(false);
  });

  it('plus de pièces avec la saison, et la monnaie de saison respecte le budget du jour', () => {
    const without = plan({ ...base(14), goal: { kind: 'coins' } });
    const free = plan({ ...base(14), goal: { kind: 'coins' }, season });
    expect(usesSeason(free)).toBe(true);
    expect(free.coinsPerHour).toBeGreaterThan(without.coinsPerHour);
    const tight = plan({ ...base(14), goal: { kind: 'coins' }, season: { notes: true, wheatPerDay: 100 } });
    expect(tight.season!.wheatPerHour * 24).toBeLessThanOrEqual(100 + 1e-6);
    expect(tight.coinsPerHour).toBeLessThanOrEqual(free.coinsPerHour + 1e-6);
  });

  it('sans Note de recette : seulement les deux recettes offertes', () => {
    const p = plan({ ...base(14), goal: { kind: 'coins' }, season: { notes: false, wheatPerDay: null } });
    expect(p.rows.some((r) => HOMELAND.season.recipeNotes.includes(r.recipe.id))).toBe(false);
  });
});
