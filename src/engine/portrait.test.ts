import { describe, expect, it } from 'vitest';
import binDataUrl from '../data/portraits.gen.bin?inline';
import meta from '../data/portraits.gen.json';
import { identify, SIDE, type Reference } from './portrait';

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
