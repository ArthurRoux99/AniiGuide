import { describe, expect, it } from 'vitest';
import { idealPool, setupWithOverrides } from './optimize';
import { opportunities } from './opportunities';
import { HOMELAND } from '../../data/homeland';

describe('quoi améliorer en premier', () => {
  it('coûts d’amélioration connus (Ferme : 10 → 480 000 pièces)', () => {
    expect(HOMELAND.levels.farmland.map((l) => l.cost)).toEqual([10, 60, 700, 6200, 23500, 107000, 480000]);
  });

  it('des Pépinières sous-améliorées : les améliorer fait gagner du temps', () => {
    const setup = setupWithOverrides(10, { woodland: { count: 5, level: 2 } });
    const ops = opportunities({ setup, workers: idealPool(26), goal: { kind: 'levelUp', stock: { coins: 0, items: {} } }, watering: true, includeUnverified: false });
    const wood = ops.filter((o) => o.facility === 'woodland');
    expect(wood.length).toBeGreaterThan(0);
    expect(wood.every((o) => o.gain > 0 && o.unit === 'hours')).toBe(true);
    expect(wood.find((o) => o.kind === 'level')!.cost).toBe(HOMELAND.levels.woodland[2].cost! * 5);
  });

  it('tout au maximum : rien à améliorer', () => {
    const setup = setupWithOverrides(8, {});
    const ops = opportunities({ setup, workers: idealPool(24), goal: { kind: 'levelUp', stock: { coins: 0, items: {} } }, watering: true, includeUnverified: false });
    expect(ops).toEqual([]);
  });
});
