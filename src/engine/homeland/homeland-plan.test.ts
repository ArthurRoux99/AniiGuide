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

  for (const rv of [8, 12]) {
    it(`niveau ${rv} : tout est posé, sans chevauchement, dans le terrain ouvert`, () => {
      const p = plan({ watering: true, includeUnverified: false, setup: setupForRv(rv), workers: idealPool(30), goal: levelUp });
      const whole = wholeUnits(p.rows);
      const t0 = performance.now();
      const h = homelandPlan(p.rows, whole, climateLayout(p, p.rows, whole), rv);
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
});
