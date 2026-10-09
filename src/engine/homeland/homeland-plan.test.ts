import { describe, expect, it } from 'vitest';
import { idealPool, plan, setupForRv, wholeUnits } from './optimize';
import { climateLayout } from './climate';
import { homelandPlan, openCells } from './homeland-plan';

const levelUp = { kind: 'levelUp', stock: { coins: 0, items: {} } } as const;
const over = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

describe('plan complet du logis', () => {
  it('terrain : la parcelle n s’ouvre au niveau n, toutes au niveau 16', () => {
    expect(openCells(1)).toHaveLength(1);
    expect(openCells(8).map((c) => c.plot).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(openCells(16)).toHaveLength(16);
  });

  for (const [rv, pairs] of [[8, false], [12, false], [14, true]] as const) {
    const exact = pairs;
    it(`niveau ${rv}${pairs ? ' avec paires' : ''} : tout est posé, sans chevauchement, dans le terrain ouvert`, () => {
      const p = plan({ watering: true, includeUnverified: false, setup: setupForRv(rv), workers: idealPool(30), goal: levelUp, pairs, exact });
      const whole = wholeUnits(p.rows);
      const t0 = performance.now();
      const h = homelandPlan(p.rows, whole, climateLayout(p, p.rows, whole), rv, p.machines);
      if (exact) expect(h.pieces.filter((x) => x.item && p.machines![`${x.facility}:${x.item}`]).length).toBe(Object.values(p.machines!).reduce((s, n) => s + n, 0));
      const ms = performance.now() - t0;
      expect(h.unplaced).toEqual([]);
      const rects = [h.storage, ...h.pieces.map((x) => x.rect)];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(over(rects[i], rects[j])).toBe(false);
      for (const r of rects) {
        const inside = h.cells.reduce((s, c) => s + Math.max(0, Math.min(r.x + r.w, c.x + c.w) - Math.max(r.x, c.x)) * Math.max(0, Math.min(r.y + r.h, c.y + c.h) - Math.max(r.y, c.y)), 0);
        expect(inside).toBeGreaterThanOrEqual(r.w * r.h - 1e-6);
      }
      expect(ms).toBeLessThan(20000);
      console.info(`RV${rv}: ${h.pieces.length} pièces, ${Math.round(ms)} ms, marche ${Math.round(h.walk)} cases/h`);
    });
  }

  it('niveau 14, équipe de niveau 2 : Générateur et Poteaux posés, chaque installation électrique alimentée', () => {
    const rv = 14;
    const p = plan({ watering: true, includeUnverified: false, setup: setupForRv(rv), workers: idealPool(22, 2), goal: levelUp, exact: true });
    const whole = wholeUnits(p.rows);
    const t0 = performance.now();
    const h = homelandPlan(p.rows, whole, climateLayout(p, p.rows, whole), rv, p.machines);
    const ms = performance.now() - t0;
    const elec = h.pieces.filter((x) => x.electric);
    expect(elec.length).toBeGreaterThan(0);
    expect(h.power?.generator).toBeTruthy();
    expect(elec.filter((x) => x.unpowered)).toEqual([]);
    const rects = [h.storage, ...h.pieces.map((x) => x.rect), h.power!.generator!, ...h.power!.poles];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(over(rects[i], rects[j])).toBe(false);
    expect(h.power!.poles.length).toBeLessThanOrEqual(12);
    expect(ms).toBeLessThan(20000);
    console.info(`RV${rv} électrique : ${elec.length} installations, ${h.power!.poles.length} poteaux, ${Math.round(ms)} ms`);
  });
});
