import { describe, expect, it } from 'vitest';
import binDataUrl from '../data/portraits.gen.bin?inline';
import meta from '../data/portraits.gen.json';
import { detectTiles, identify, rankWithBadges, readBadges, SIDE, type Reference } from './portrait';

const bytes = Uint8Array.from(atob(binDataUrl.split(',')[1]), (c) => c.charCodeAt(0));
const px = SIDE * SIDE;
const refs: Reference[] = meta.ids.flatMap((id, i) =>
  Array.from({ length: meta.windows }, (_, w) => {
    const o = (i * meta.windows + w) * px * 4;
    const rgb = new Float32Array(px * 3);
    const mask = new Float32Array(px);
    for (let p = 0; p < px; p++) {
      for (let c = 0; c < 3; c++) rgb[p * 3 + c] = bytes[o + p * 4 + c] / 255;
      mask[p] = bytes[o + p * 4 + 3] ? 1 : 0;
    }
    return { key: id, rgb, mask };
  }),
);

/** Une « capture » : le gros plan d'un portrait agrandi 8×, posé sur un fond gris, avec du bruit. */
function fakeCapture(ref: Reference) {
  const k = 8, pad = 40, w = SIDE * k + pad * 2;
  const data = new Uint8ClampedArray(w * w * 4);
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 20;
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const i = Math.floor((x - pad) / k), j = Math.floor((y - pad) / k);
      const inside = i >= 0 && j >= 0 && i < SIDE && j < SIDE && ref.mask[j * SIDE + i];
      for (let c = 0; c < 3; c++) data[(y * w + x) * 4 + c] = inside ? ref.rgb[(j * SIDE + i) * 3 + c] * 230 + 10 + noise() : 70;
      data[(y * w + x) * 4 + 3] = 255;
    }
  return { img: { data, width: w, height: w }, center: w / 2, size: SIDE * k };
}

describe('reconnaissance des portraits', () => {
  it('références présentes pour toutes les fiches', () => {
    expect(refs.length).toBe(meta.ids.length * meta.windows);
  });

  it('retrouve un Aniimo à partir de son portrait recadré (éclairage et bruit en plus)', () => {
    let top1 = 0;
    const sample = meta.ids.filter((_, i) => i % 20 === 0);
    for (const id of sample) {
      const ref = refs.find((r) => r.key === id && r === refs[meta.ids.indexOf(id) * meta.windows + 2])!;
      const { img, center, size } = fakeCapture(ref);
      const [best] = identify(img, center, center, size, refs, 3);
      if (best.key === id) top1++;
    }
    expect(top1).toBeGreaterThanOrEqual(sample.length - 1);
  });
});

describe('repérage des cases', () => {
  it('retrouve la grille, ignore une case sélectionnée (fond blanc) et un en-tête', () => {
    const W = 1000, H = 800, S = 120, PITCH = 160, ROW = 170;
    const data = new Uint8ClampedArray(W * H * 4);
    const put = (x: number, y: number, c: number[]) => data.set([...c, 255], (y * W + x) * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [222, 234, 210]); // panneau clair
    // En-tête foncé isolé (comme « 24/24 »).
    for (let y = 20; y < 70; y++) for (let x = 800; x < 900; x++) put(x, y, [84, 87, 104]);
    const expected: [number, number][] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) {
        const x0 = 100 + c * PITCH, y0 = 150 + r * ROW;
        const selected = r === 1 && c === 4;
        for (let y = y0; y < y0 + S + 30; y++)
          for (let x = x0; x < x0 + S; x++) {
            const creature = Math.hypot(x - x0 - S / 2, y - y0 - S / 2) < S * 0.3; // l'Aniimo au centre
            put(x, y, selected ? [250, 250, 250] : creature ? [200, 120, 60] : [84, 87, 104]);
          }
        if (!selected) expected.push([x0 + S / 2, y0 + S / 2]);
      }
    const tiles = detectTiles({ data, width: W, height: H });
    expect(tiles).toHaveLength(expected.length);
    for (const [x, y] of expected) expect(tiles.some((t) => Math.abs(t.x - x) < S * 0.2 && Math.abs(t.y - y) < S * 0.3)).toBe(true);
  });
});

describe('pastilles de capacités', () => {
  it('lit les couleurs des pastilles sous une case et reclasse les candidats', () => {
    const W = 200, H = 200;
    const data = new Uint8ClampedArray(W * H * 4).fill(230);
    const dot = (cx: number, cy: number, c: number[]) => {
      for (let y = cy - 10; y <= cy + 10; y++) for (let x = cx - 10; x <= cx + 10; x++) if (Math.hypot(x - cx, y - cy) <= 10) data.set([...c, 255], (y * W + x) * 4);
    };
    // Case de 100 px centrée en (100, 80) : pastilles Eau et Transport dessous.
    dot(85, 135, [68, 142, 237]);
    dot(115, 135, [109, 133, 197]);
    const badges = readBadges({ data, width: W, height: H }, 100, 80, 100);
    expect(badges.sort()).toEqual(['hauling', 'water']);
    const ranked = rankWithBadges(
      [{ key: 'a', score: 0.3 }, { key: 'b', score: 0.5 }],
      badges,
      (k) => (k === 'a' ? ['fire'] : ['water', 'hauling']),
    );
    expect(ranked[0].key).toBe('b');
  });
});
