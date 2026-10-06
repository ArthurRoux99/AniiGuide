import { describe, expect, it } from 'vitest';
import { heistPlan } from './eggheist';

const base = { price: { coins: 400000, shards: 200 }, have: { coins: 0, shards: 0 }, perRun: { coins: 50000, shards: 3 }, success: 1, lossOnFail: 0, minutes: 10 };

describe('Opération Œufs : nombre de parties', () => {
  it('compte les pièces et les éclats, garde le plus contraignant', () => {
    const r = heistPlan(base);
    expect(r.runs).toBe(67); // 200 éclats / 3 par partie
    expect(r.limit).toBe('shards');
    expect(r.hours).toBeCloseTo(67 * 10 / 60);
  });
  it('les échecs coûtent l’équipement perdu', () => {
    const r = heistPlan({ ...base, price: { coins: 100000, shards: 0 }, success: 0.5, lossOnFail: 40000 });
    expect(r.netCoins).toBe(5000);
    expect(r.runs).toBe(20);
  });
  it('partie perdante en moyenne : jamais', () => {
    const r = heistPlan({ ...base, price: { coins: 100000, shards: 0 }, success: 0.2, lossOnFail: 50000 });
    expect(r.runs).toBeNull();
  });
  it('déjà assez : zéro partie', () => {
    expect(heistPlan({ ...base, have: { coins: 400000, shards: 200 } }).runs).toBe(0);
  });
});
