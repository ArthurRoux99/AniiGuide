import { describe, expect, it } from 'vitest';
import { idealPool, plan, setupForRv } from './optimize';
import { HOMELAND } from '../../data/homeland';

const base = (rv: number) => ({ setup: setupForRv(rv), workers: idealPool(30), watering: true, includeUnverified: false });
const usesSeason = (p: ReturnType<typeof plan>) => p.rows.some((r) => r.recipe.season);

describe('Lune des moissons', () => {
  it('recettes de saison importées (8, dont 4 à Note de recette), points par objet', () => {
    expect(HOMELAND.recipes.filter((r) => r.season)).toHaveLength(8);
    expect(HOMELAND.season.recipeNotes).toHaveLength(4);
    expect(HOMELAND.items.harvest_platter.points).toBe(8);
  });

  it('sans la saison, ou avant le niveau 10 : aucune recette de saison', () => {
    expect(usesSeason(plan({ ...base(12), goal: { kind: 'coins' } }))).toBe(false);
    expect(usesSeason(plan({ ...base(9), goal: { kind: 'coins' }, season: { notes: true, wheatPerDay: null } }))).toBe(false);
  });

  it('objectif points : des points, et le Blé de lune respecte le budget du jour', () => {
    const free = plan({ ...base(12), goal: { kind: 'points' }, season: { notes: true, wheatPerDay: null } });
    expect(free.season!.pointsPerHour).toBeGreaterThan(100);
    const tight = plan({ ...base(12), goal: { kind: 'points' }, season: { notes: true, wheatPerDay: 240 } });
    expect(tight.season!.wheatPerHour * 24).toBeLessThanOrEqual(240 + 1e-6);
    expect(tight.season!.pointsPerHour).toBeLessThan(free.season!.pointsPerHour);
  });

  it('sans Note de recette : pas de Plateau des moissons', () => {
    const p = plan({ ...base(14), goal: { kind: 'points' }, season: { notes: false, wheatPerDay: null } });
    expect(p.rows.some((r) => HOMELAND.season.recipeNotes.includes(r.recipe.id))).toBe(false);
  });
});
