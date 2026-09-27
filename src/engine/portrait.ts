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

/** Segments [début, fin] où `profile` dépasse `threshold`, les trous plus courts que `gap` étant comblés. */
function runs(profile: Float32Array, threshold: number, gap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1, last = -1;
  profile.forEach((v, i) => {
    if (v < threshold) return;
    if (start >= 0 && i - last > gap) {
      out.push([start, last]);
      start = -1;
    }
    if (start < 0) start = i;
    last = i;
  });
  if (start >= 0) out.push([start, last]);
  return out;
}

/**
 * Repère les cases de portrait d'une capture de la liste du logis. Le fond des cases est un
 * gris-bleu foncé uni sur un panneau clair, rangé en grille : les colonnes de cases ressortent
 * dans le profil vertical de ces pixels, puis, dans chaque colonne, les rangées dans le profil
 * horizontal. On garde les colonnes de même largeur, régulièrement espacées.
 */
export function detectTiles(img: Rgba): { x: number; y: number; size: number }[] {
  const step = Math.max(1, Math.round(img.width / 500));
  const w = Math.floor(img.width / step), h = Math.floor(img.height / step);
  const on = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = (j * step * img.width + i * step) * 4;
      const r = img.data[k], g = img.data[k + 1], b = img.data[k + 2];
      on[j * w + i] = r >= 55 && r <= 125 && g >= 55 && g <= 125 && b >= 70 && b <= 145 && b - r >= 6 && b - r <= 40 && Math.abs(r - g) <= 14 ? 1 : 0;
    }

  // Colonnes : part de pixels « fond de case » par colonne de l'image.
  const colProfile = new Float32Array(w);
  for (let i = 0; i < w; i++) {
    let n = 0;
    for (let j = 0; j < h; j++) n += on[j * w + i];
    colProfile[i] = n / h;
  }
  // Lissage : l'Aniimo dessiné dans la case creuse le profil par endroits.
  const win = Math.max(1, Math.round(w * 0.008));
  const smooth = colProfile.map((_, i) => {
    let s = 0, n = 0;
    for (let d = -win; d <= win; d++) if (i + d >= 0 && i + d < w) {
      s += colProfile[i + d];
      n++;
    }
    return s / n;
  });
  const colMax = Math.max(...smooth);
  let cols = runs(smooth, colMax * 0.2, 1).filter(([a, b]) => b - a >= w * 0.03 && b - a <= w * 0.3);
  if (cols.length < 2) return [];
  // Colonnes de la grille : largeur proche de la médiane.
  const widths = cols.map(([a, b]) => b - a + 1).sort((x, y) => x - y);
  const size = widths[Math.floor(widths.length / 2)];
  cols = cols.filter(([a, b]) => Math.abs(b - a + 1 - size) <= size * 0.2);
  // Une colonne collée à un autre élément de l'écran se retrouve fusionnée avec lui : on la
  // reconstitue d'après l'espacement régulier de la grille.
  if (cols.length >= 2) {
    const gaps = cols.slice(1).map(([a], k) => a - cols[k][0]).sort((x, y) => x - y);
    const pitch = gaps[Math.floor(gaps.length / 2)];
    const filled = (a: number) => {
      let v = 0;
      for (let i = a; i < a + size; i++) v += colProfile[i] ?? 0;
      return v / size >= colMax * 0.2;
    };
    for (let a = cols[0][0] - pitch; a >= 0 && filled(a); a -= pitch) cols.unshift([a, a + size - 1]);
    for (let a = cols[cols.length - 1][0] + pitch; a + size <= w && filled(a); a += pitch) cols.push([a, a + size - 1]);
  }

  // Rangées : communes à toutes les colonnes (profil horizontal sur l'ensemble des colonnes).
  const inCols = (i: number) => cols.some(([a, b]) => i >= a && i <= b);
  const colPx = cols.reduce((n, [a, b]) => n + b - a + 1, 0);
  const rowProfile = new Float32Array(h);
  for (let j = 0; j < h; j++) {
    let n = 0;
    for (let i = 0; i < w; i++) if (on[j * w + i] && inCols(i)) n++;
    rowProfile[j] = n / colPx;
  }
  const bands = runs(rowProfile, 0.03, 2).filter(([t, b]) => b - t + 1 >= size * 0.4);
  if (!bands.length) return [];
  // Hauteur d'une rangée entière (portrait + pastilles) ; une rangée coupée par le bord de la
  // liste est complétée vers le haut (les pastilles sont en bas).
  const full = Math.max(...bands.map(([t, b]) => b - t + 1));
  const tiles: { x: number; y: number; size: number }[] = [];
  for (const [top, bottom] of bands) {
    const cy = bottom - full + 1 + size * 0.5;
    if (cy < size * 0.2) continue; // en-tête coupé, pas une rangée de la liste
    const row: { x: number; y: number; size: number }[] = [];
    for (const [a, b] of cols) {
      // Case vide ou case sélectionnée (fond blanc) : pas de fond de case sous le portrait.
      let n = 0, tot = 0;
      for (let j = Math.max(top, Math.round(cy - size / 2)); j <= Math.min(bottom, Math.round(cy + size / 2)); j++)
        for (let i = a; i <= b; i++) {
          n += on[j * w + i];
          tot++;
        }
      if (!tot || n / tot < 0.08) continue;
      row.push({ x: ((a + b + 1) / 2) * step, y: cy * step, size: size * step });
    }
    // Une vraie rangée de la liste occupe plusieurs colonnes (sinon : un bouton, un en-tête…).
    if (row.length >= Math.min(2, cols.length)) tiles.push(...row);
  }
  return tiles.sort((p, q) => p.y - q.y || p.x - q.x);
}

/**
 * Couleur des pastilles de capacités sous chaque portrait (relevée sur l'en-tête « Distribution
 * des capacités » du jeu).
 */
export const BADGE_COLORS: Record<string, [number, number, number]> = {
  fire: [200, 106, 94],
  grass: [92, 160, 101],
  water: [68, 142, 237],
  earth: [181, 163, 117],
  lightning: [218, 193, 74],
  ice: [120, 204, 230],
  wind: [123, 196, 177],
  dark: [132, 101, 168],
  light: [215, 171, 98],
  hauling: [109, 133, 197],
  artisanship: [134, 177, 97],
  leisure: [220, 126, 150],
  perfumery: [167, 129, 206],
};

/**
 * Capacités lues sur les pastilles sous un portrait (case centrée en x, y, de côté size) :
 * chaque pixel coloré est rattaché à la couleur de pastille la plus proche ; on garde les
 * couleurs assez présentes.
 */
export function readBadges(img: Rgba, x: number, y: number, size: number): string[] {
  const entries = Object.entries(BADGE_COLORS);
  const counts = new Map<string, number>();
  const y0 = Math.round(y + size * 0.36), y1 = Math.round(y + size * 0.68);
  const x0 = Math.round(x - size * 0.45), x1 = Math.round(x + size * 0.45);
  const stride = Math.max(1, Math.round(size / 80));
  for (let j = Math.max(0, y0); j < Math.min(img.height, y1); j += stride)
    for (let i = Math.max(0, x0); i < Math.min(img.width, x1); i += stride) {
      const k = (j * img.width + i) * 4;
      const r = img.data[k], g = img.data[k + 1], b = img.data[k + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) < 40) continue; // gris, blanc (chiffres), fond
      let best = '', bd = Infinity;
      for (const [id, [cr, cg, cb]] of entries) {
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
      if (bd < 38 ** 2) counts.set(best, (counts.get(best) ?? 0) + 1);
    }
  const max = Math.max(0, ...counts.values());
  const minPx = ((x1 - x0) * (y1 - y0)) / stride ** 2 * 0.02;
  return [...counts].filter(([, n]) => n >= max * 0.3 && n >= minPx).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/**
 * Reclasse les candidats avec les pastilles lues : chaque capacité en trop ou en moins par rapport
 * à l'Aniimo candidat coûte `penalty` (les scores de portrait vont d'environ 0,1 à 1).
 */
export function rankWithBadges(
  candidates: { key: string; score: number }[],
  badges: readonly string[],
  abilitiesOf: (key: string) => readonly string[],
  penalty = 0.5,
): { key: string; score: number }[] {
  if (!badges.length) return candidates;
  const seen = new Set(badges);
  return candidates
    .map((c) => {
      const mine = abilitiesOf(c.key);
      const diff = mine.filter((a) => !seen.has(a)).length + badges.filter((a) => !mine.includes(a)).length;
      return { key: c.key, score: c.score + penalty * diff };
    })
    .sort((a, b) => a.score - b.score);
}
