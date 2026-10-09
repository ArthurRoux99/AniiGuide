import type { Rect } from './layout.js';

// Réseau électrique du plan du logis : un Générateur crépitant et des Poteaux électriques
// crépitants posés pour que chaque installation en mode électrique touche une zone alimentée.
// Portées (carré centré sur l'objet) et tailles relevées par aniimofrance.com ; une installation
// est alimentée dès qu'elle touche le carré du Générateur ou celui d'un Poteau relié, un Poteau
// est relié s'il touche le carré du Générateur ou d'un Poteau déjà relié (règle du jeu décrite par
// les guides, à confirmer en jeu).

export const GENERATOR: { size: number; range: number } = {
  size: 2,
  range: 11,
};
export const POLE: { size: number; range: number } = { size: 1.5, range: 7 };
/** Poteaux autorisés par niveau du Camping-car (module électrique). */
export const POLES_BY_RV: Record<number, number> = {
  12: 6,
  13: 6,
  14: 12,
  15: 12,
  16: 18,
  17: 18,
  18: 24,
  19: 24,
  20: 30,
};

export interface PowerLayout {
  generator: Rect | null;
  poles: Rect[];
  /** Index (dans `targets`) des installations restées hors réseau. */
  unpowered: number[];
  /** Installations déplacées pour rejoindre le réseau : nouvelle place (index dans `targets` ou `others`). */
  moves: { target: number; to: Rect; swapWith?: number }[];
}

const STEP = 0.5;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const zone = (r: Rect, range: number): Rect => ({
  x: r.x + r.w / 2 - range / 2,
  y: r.y + r.h / 2 - range / 2,
  w: range,
  h: range,
});
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Le rectangle tient-il entièrement sur le terrain ouvert, sans rien chevaucher ? */
function free(r: Rect, cells: Rect[], taken: Rect[]): boolean {
  for (let y = r.y + STEP / 2; y < r.y + r.h; y += STEP)
    for (let x = r.x + STEP / 2; x < r.x + r.w; x += STEP) if (!cells.some((c) => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h)) return false;
  return !taken.some((t) => overlap(r, t));
}

/** Toutes les positions libres d'un objet carré de côté `size`, au pas d'une demi-case. */
function spots(size: number, cells: Rect[], taken: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (const c of cells)
    for (let y = c.y; y + size <= c.y + c.h; y += STEP)
      for (let x = c.x; x + size <= c.x + c.w; x += STEP) {
        const r = { x, y, w: size, h: size };
        if (free(r, cells, taken)) out.push(r);
      }
  return out;
}

/**
 * Pose le Générateur là où il alimente le plus d'installations électriques (au plus près de
 * leur centre à égalité), puis des Poteaux reliés, un à un, tant qu'il en reste à alimenter et
 * que le niveau en autorise.
 */
export function powerLayout(cells: Rect[], taken: Rect[], targets: Rect[], rv: number, others: Rect[] = [], fixedGenerator?: Rect): PowerLayout {
  if (!targets.length) return { generator: null, poles: [], unpowered: [], moves: [] };
  targets = targets.map((t) => ({ ...t }));
  others = others.map((t) => ({ ...t }));
  const moves: PowerLayout['moves'] = [];
  const occupied = [...taken];
  const mid = targets.reduce(
    (s, t) => ({
      x: s.x + centre(t).x / targets.length,
      y: s.y + centre(t).y / targets.length,
    }),
    { x: 0, y: 0 },
  );
  const dist = (r: Rect) => Math.hypot(centre(r).x - mid.x, centre(r).y - mid.y);

  let generator: Rect | null = fixedGenerator ?? null;
  let best = -1;
  if (!fixedGenerator)
    for (const r of spots(GENERATOR.size, cells, occupied)) {
      const z = zone(r, GENERATOR.range);
      const n = targets.filter((t) => overlap(t, z)).length;
      if (n > best || (n === best && generator && dist(r) < dist(generator))) {
        best = n;
        generator = r;
      }
    }
  if (!generator)
    return {
      generator: null,
      poles: [],
      unpowered: targets.map((_, i) => i),
      moves,
    };
  if (!fixedGenerator) occupied.push(generator);

  const zones = [zone(generator, GENERATOR.range)];
  const powered = (t: Rect) => zones.some((z) => overlap(t, z));
  // Rapprocher les installations électriques du réseau : échange avec une installation non
  // électrique de même taille déjà alimentée, ou place libre qui touche une zone alimentée.
  const relocate = () => {
    targets.forEach((t, i) => {
      if (powered(t)) return;
      const j = others.findIndex((o) => o.w === t.w && o.h === t.h && powered(o));
      if (j >= 0) {
        const a = { x: t.x, y: t.y };
        Object.assign(t, { x: others[j].x, y: others[j].y });
        Object.assign(others[j], a);
        moves.push({ target: i, to: { ...t }, swapWith: j });
        return;
      }
      const rest = occupied.filter((r) => !(r.x === t.x && r.y === t.y && r.w === t.w && r.h === t.h));
      const spot = spots(t.w === t.h ? t.w : Math.max(t.w, t.h), cells, rest).find(
        (r) => zones.some((z) => overlap({ ...r, w: t.w, h: t.h }, z)) && free({ ...r, w: t.w, h: t.h }, cells, rest),
      );
      if (spot) {
        const k = occupied.findIndex((r) => r.x === t.x && r.y === t.y && r.w === t.w && r.h === t.h);
        Object.assign(t, { x: spot.x, y: spot.y });
        if (k >= 0) occupied[k] = { ...t };
        moves.push({ target: i, to: { ...t } });
      }
    });
  };
  relocate();
  const poles: Rect[] = [];
  const max = POLES_BY_RV[Math.min(20, rv)] ?? 0;
  while (poles.length < max) {
    const left = targets.filter((t) => !powered(t));
    if (!left.length) break;
    // Un Poteau relié qui alimente le plus d'installations encore hors réseau ; sinon, celui qui
    // rapproche le réseau de la plus proche d'entre elles.
    const linked = spots(POLE.size, cells, occupied).filter((r) => zones.some((z) => overlap(r, z)));
    if (!linked.length) break;
    const gap = (r: Rect) => Math.min(...left.map((t) => Math.hypot(centre(t).x - centre(r).x, centre(t).y - centre(r).y)));
    let pick = linked[0];
    let score = -1;
    for (const r of linked) {
      const z = zone(r, POLE.range);
      const n = left.filter((t) => overlap(t, z)).length;
      if (n > score || (n === score && gap(r) < gap(pick))) {
        score = n;
        pick = r;
      }
    }
    poles.push(pick);
    occupied.push(pick);
    zones.push(zone(pick, POLE.range));
  }
  relocate();
  return {
    generator,
    poles,
    unpowered: targets.flatMap((t, i) => (powered(t) ? [] : [i])),
    moves,
  };
}
