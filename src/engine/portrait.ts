// Reconnaissance des portraits d'Aniimo sur une capture d'écran du jeu.
//
// La liste des Aniimo du logis n'affiche que des portraits (sans nom). On compare la zone touchée
// par le joueur aux portraits du wiki officiel (Wiki_PetHead), réduits à SIDE×SIDE pixels :
// uniquement les pixels de l'Aniimo (transparence du portrait officiel), couleurs normalisées
// (moyenne et écart-type par canal) pour encaisser l'éclairage et la compression. On essaie
// plusieurs cadrages autour du point touché, car le jeu recadre un peu ses portraits.

export const SIDE = 16;

export interface Rgba {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Reference {
  key: string;
  /** SIDE×SIDE×3 couleurs (0..1) et SIDE×SIDE masque (0..1). */
  rgb: Float32Array;
  mask: Float32Array;
}

/** Échantillonne un carré (x0, y0, taille) d'une image en SIDE×SIDE (moyenne de 3×3 points par case). */
function sample(img: Rgba, x0: number, y0: number, size: number): { rgb: Float32Array; alpha: Float32Array } {
  const rgb = new Float32Array(SIDE * SIDE * 3);
  const alpha = new Float32Array(SIDE * SIDE);
  const cell = size / SIDE;
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let v = 0; v < 3; v++)
        for (let u = 0; u < 3; u++) {
          const x = Math.round(x0 + (i + (u + 0.5) / 3) * cell);
          const y = Math.round(y0 + (j + (v + 0.5) / 3) * cell);
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          const k = (y * img.width + x) * 4;
          const al = img.data[k + 3] / 255;
          r += (img.data[k] / 255) * al;
          g += (img.data[k + 1] / 255) * al;
          b += (img.data[k + 2] / 255) * al;
          a += al;
          n++;
        }
      const p = j * SIDE + i;
      alpha[p] = n ? a / n : 0;
      if (a > 0) {
        rgb[p * 3] = r / a;
        rgb[p * 3 + 1] = g / a;
        rgb[p * 3 + 2] = b / a;
      }
    }
  return { rgb, alpha };
}

/**
 * Cadrages essayés sur le portrait officiel (x, y, côté, en fraction de l'image) : le portrait
 * entier, puis des gros plans du haut, car le jeu cadre ses cases sur le visage.
 */
export const WINDOWS: [number, number, number][] = [
  [0, 0, 1],
  [0.12, 0, 0.76],
  [0.2, 0.02, 0.6],
  [0.25, 0.08, 0.5],
  [0.15, 0.15, 0.7],
];

/** Portrait officiel → références, une par cadrage (sa transparence sert de masque). */
export function makeReferences(key: string, img: Rgba): Reference[] {
  const full = Math.min(img.width, img.height);
  return WINDOWS.map(([x, y, side]) => {
    const { rgb, alpha } = sample(img, x * full, y * full, side * full);
    return { key, rgb, mask: alpha.map((a) => (a > 0.6 ? 1 : 0)) };
  });
}

/** Partie basse ignorée : le jeu y affiche les pastilles de capacités. */
const BOTTOM_IGNORED = 0.22;

interface Prepared {
  key: string;
  idx: Uint16Array; // pixels retenus
  ref: Float32Array; // couleurs normalisées de la référence, 3 par pixel retenu
}
const prepCache = new WeakMap<Reference, Prepared | null>();

function prepare(r: Reference): Prepared | null {
  const limit = Math.floor(SIDE * (1 - BOTTOM_IGNORED)) * SIDE;
  const idx: number[] = [];
  for (let p = 0; p < limit; p++) if (r.mask[p]) idx.push(p);
  if (idx.length < 20) return null;
  const ref = new Float32Array(idx.length * 3);
  for (let c = 0; c < 3; c++) {
    let s = 0, s2 = 0;
    for (const p of idx) {
      s += r.rgb[p * 3 + c];
      s2 += r.rgb[p * 3 + c] ** 2;
    }
    const mean = s / idx.length;
    const sd = Math.sqrt(Math.max(1e-4, s2 / idx.length - mean * mean));
    idx.forEach((p, k) => (ref[k * 3 + c] = (r.rgb[p * 3 + c] - mean) / sd));
  }
  return { key: r.key, idx: Uint16Array.from(idx), ref };
}

/** Écart entre une zone et une référence : couleurs de la zone normalisées sous le masque. */
function distance(crop: Float32Array, p: Prepared): number {
  const n = p.idx.length;
  let d = 0;
  for (let c = 0; c < 3; c++) {
    let s = 0, s2 = 0;
    for (let k = 0; k < n; k++) {
      const v = crop[p.idx[k] * 3 + c];
      s += v;
      s2 += v * v;
    }
    const mean = s / n;
    const inv = 1 / Math.sqrt(Math.max(1e-4, s2 / n - mean * mean));
    for (let k = 0; k < n; k++) {
      const e = (crop[p.idx[k] * 3 + c] - mean) * inv - p.ref[k * 3 + c];
      d += e * e;
    }
  }
  return d / (n * 3);
}

/**
 * Classe les références pour la zone centrée sur (cx, cy) de côté `size` (taille approximative
 * d'une case de la liste). Score : écart moyen (plus petit = plus ressemblant).
 */
export function identify(img: Rgba, cx: number, cy: number, size: number, refs: readonly Reference[], top = 5): { key: string; score: number }[] {
  const crops: Float32Array[] = [];
  for (const scale of [0.8, 0.9, 1, 1.1, 1.25])
    for (const dy of [-0.12, -0.06, 0, 0.06])
      for (const dx of [-0.06, 0, 0.06]) {
        const s = size * scale;
        crops.push(sample(img, cx - s / 2 + dx * size, cy - s / 2 + dy * size, s).rgb);
      }
  // Une même espèce a plusieurs cadrages : on garde le meilleur.
  const byKey = new Map<string, number>();
  for (const r of refs) {
    let p = prepCache.get(r);
    if (p === undefined) {
      p = prepare(r);
      prepCache.set(r, p);
    }
    if (!p) continue;
    let score = byKey.get(r.key) ?? Infinity;
    for (const crop of crops) score = Math.min(score, distance(crop, p));
    byKey.set(r.key, score);
  }
  return [...byKey].map(([key, score]) => ({ key, score })).sort((a, b) => a.score - b.score).slice(0, top);
}

/** Encode / décode une référence en base64 (données embarquées dans le site). */
export function packReference(r: Reference): string {
  const bytes = new Uint8Array(SIDE * SIDE * 4);
  for (let p = 0; p < SIDE * SIDE; p++) {
    bytes[p * 4] = Math.round(r.rgb[p * 3] * 255);
    bytes[p * 4 + 1] = Math.round(r.rgb[p * 3 + 1] * 255);
    bytes[p * 4 + 2] = Math.round(r.rgb[p * 3 + 2] * 255);
    bytes[p * 4 + 3] = r.mask[p] ? 255 : 0;
  }
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function unpackReference(key: string, b64: string): Reference {
  const s = atob(b64);
  const rgb = new Float32Array(SIDE * SIDE * 3);
  const mask = new Float32Array(SIDE * SIDE);
  for (let p = 0; p < SIDE * SIDE; p++) {
    rgb[p * 3] = s.charCodeAt(p * 4) / 255;
    rgb[p * 3 + 1] = s.charCodeAt(p * 4 + 1) / 255;
    rgb[p * 3 + 2] = s.charCodeAt(p * 4 + 2) / 255;
    mask[p] = s.charCodeAt(p * 4 + 3) ? 1 : 0;
  }
  return { key, rgb, mask };
}
