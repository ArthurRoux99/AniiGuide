#!/usr/bin/env node
// Paires Fournaise thermique (1×1) + Climatisation (2×2) dont les zones se chevauchent : la zone
// commune prend la somme des températures (Chaud + Gel = Frais, Brûlant + Frais = Chaud). Règles et
// écarts possibles : Aniimax (MIT, src/coverage.rs). Pour chaque écart, on cherche (HiGHS, en
// nombres entiers, parcelles sur cases entières) les meilleurs placements selon plusieurs priorités
// entre les trois zones (Fournaise seule, les deux, Climatisation seule) et les types de parcelles ;
// chaque placement est un point extrême utilisable par l'optimiseur.
//
// Usage : node scripts/build-pair-layouts.mjs  → data/pair-layouts.json

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import loadHighs from 'highs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const highs = await loadHighs();
const R = 4.5;
const SIZE = { farmland: 2, woodland: 4, big: 5 };
const KINDS = Object.keys(SIZE);
const over = (a, b) => a.x1 < b.x2 - 1e-6 && a.x2 > b.x1 + 1e-6 && a.y1 < b.y2 - 1e-6 && a.y2 > b.y1 + 1e-6;
const rect = (x, y, w) => ({ x1: x, y1: y, x2: x + w, y2: y + w });

function solve(dx, dy, zoneW, kindW) {
  const A = rect(0.5 - R, 0.5 - R, 2 * R); // Fournaise en [0,1]²
  const B = rect(dx + 1 - R, dy + 1 - R, 2 * R); // Climatisation en [dx,dx+2]×[dy,dy+2]
  const buildings = [rect(0, 0, 1), rect(dx, dy, 2)];
  const cands = [];
  for (const kind of KINDS) {
    const s = SIZE[kind];
    for (let x = Math.ceil(A.x1 - s); x <= B.x2; x++)
      for (let y = Math.ceil(Math.min(A.y1, B.y1) - s); y <= Math.max(A.y2, B.y2); y++) {
        const r = rect(x, y, s);
        const a = over(r, A), b = over(r, B);
        if (!a && !b) continue;
        if (buildings.some((bd) => over(r, bd))) continue;
        cands.push({ kind, x, y, zone: a && b ? 1 : a ? 0 : 2 });
      }
  }
  const cells = new Map();
  cands.forEach((p, i) => {
    for (let u = 0; u < SIZE[p.kind]; u++)
      for (let v = 0; v < SIZE[p.kind]; v++) {
        const k = `${p.x + u},${p.y + v}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(i);
      }
  });
  const v = (i) => `x${i}`;
  const lines = ['Maximize', ' obj: ' + cands.map((p, i) => `${zoneW[p.zone] * kindW[p.kind]} ${v(i)}`).join(' + '), 'Subject To'];
  let n = 0;
  for (const list of cells.values()) if (list.length > 1) lines.push(` c${n++}: ${list.map(v).join(' + ')} <= 1`);
  lines.push('Binary', ' ' + cands.map((_, i) => v(i)).join(' '), 'End');
  const r = highs.solve(lines.join('\n'));
  if (r.Status !== 'Optimal') return null;
  const plots = cands.filter((_, i) => r.Columns[v(i)].Primal > 0.5).map(({ kind, x, y, zone }) => ({ kind, x, y, zone }));
  const counts = [0, 1, 2].map((z) => KINDS.map((k) => plots.filter((p) => p.zone === z && p.kind === k).length));
  return { dx, dy, counts, plots };
}

// Priorités : surface par défaut, puis une zone ou deux mises en avant, et chaque type favorisé.
const ZONES = [[1, 1, 1]];
for (const s of [3, 10]) {
  ZONES.push([s, 1, 1], [1, s, 1], [1, 1, s], [s, s, 1], [1, s, s], [s, 1, s]);
}
const AREA = { farmland: 4, woodland: 16, big: 25 };
const KIND_WEIGHTS = [AREA, ...KINDS.map((k) => ({ ...AREA, [k]: AREA[k] * 4 }))];

const seen = new Map();
for (let dx = 0; dx <= 8; dx++)
  for (let dy = 0; dy <= dx; dy++) {
    if (dx < 1 && dy < 1) continue; // l'une sur l'autre
    for (const zw of ZONES)
      for (const kw of KIND_WEIGHTS) {
        const s = solve(dx, dy, zw, kw);
        if (!s) continue;
        const key = JSON.stringify(s.counts);
        if (!seen.has(key)) seen.set(key, s);
      }
  }
// On écarte les placements dominés (un autre au moins aussi bon dans chaque zone et type).
const all = [...seen.values()];
const flat = (s) => s.counts.flat();
const kept = all.filter((p) => !all.some((q) => q !== p && flat(q).every((x, i) => x >= flat(p)[i]) && flat(q).some((x, i) => x > flat(p)[i])));
await writeFile(join(ROOT, 'data/pair-layouts.json'), JSON.stringify({ source: 'Règles et écarts : Aniimax (MIT) ; calcul AniiGuide', kinds: KINDS, layouts: kept }) + '\n');
console.log(`data/pair-layouts.json : ${kept.length} placements non dominés (sur ${all.length})`);
