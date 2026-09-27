#!/usr/bin/env node
// Placements optimaux autour d'un appareil climatique (Radiateur, Refroidisseur, Lampe solaire).
//
// Règles de couverture (relevées en jeu par le projet Aniimax, MIT, src/coverage.rs ; confirmées
// sur une capture du jeu) :
// - l'appareil couvre un carré de 9×9 cases centré sur son propre centre ; le Radiateur et la
//   Lampe solaire occupent 1 case, le Refroidisseur 2×2 ;
// - une parcelle est couverte dès qu'elle chevauche ce carré (une surface, pas un simple coin) ;
// - Ferme 2×2, Pépinière 4×4, Château de sable / Hamac / Moulin floral 5×5 ; les parcelles se posent au quart de case près, sans se chevaucher
//   ni chevaucher l'appareil.
//
// Pour chaque taille d'appareil et chaque nombre de Pépinières, on cherche (programme en nombres
// entiers, HiGHS) le maximum de Fermes, sur plusieurs calages au quart de case. Résultat :
// data/climate-layouts.json (positions exactes, relatives au coin de l'appareil).
//
// Usage : node scripts/build-climate-layouts.mjs

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import loadHighs from 'highs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const highs = await loadHighs();
const R = 4.5;
const FARM = 2, WOOD = 4, BIG = 5;
const OFFSETS = [[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [0.25, 0.75], [0.5, 0], [0, 0.5], [0.25, 0.5]];
const over = (a0, a1, b0, b1) => a0 < b1 - 1e-6 && a1 > b0 + 1e-6;

function solve(b, offset, woods, bigs) {
  const c = b / 2, lo = c - R, hi = c + R;
  const cands = [];
  for (const [kind, s] of [['farmland', FARM], ['woodland', WOOD], ['big', BIG]])
    for (let x = Math.floor(lo - s) - 1; x <= hi + 1; x++)
      for (let y = Math.floor(lo - s) - 1; y <= hi + 1; y++) {
        const X = x + offset[0], Y = y + offset[1];
        if (!(over(X, X + s, lo, hi) && over(Y, Y + s, lo, hi))) continue; // hors zone
        if (over(X, X + s, 0, b) && over(Y, Y + s, 0, b)) continue; // sur l'appareil
        cands.push({ kind, x: X, y: Y, s });
      }
  const cells = new Map();
  cands.forEach((p, i) => {
    for (let dx = 0; dx < p.s; dx++)
      for (let dy = 0; dy < p.s; dy++) {
        const k = `${Math.round((p.x + dx) * 4)},${Math.round((p.y + dy) * 4)}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(i);
      }
  });
  const v = (i) => `x${i}`;
  const farms = cands.map((p, i) => (p.kind === 'farmland' ? v(i) : null)).filter(Boolean);
  const wds = cands.map((p, i) => (p.kind === 'woodland' ? v(i) : null)).filter(Boolean);
  const bg = cands.map((p, i) => (p.kind === 'big' ? v(i) : null)).filter(Boolean);
  const lines = ['Maximize', ` obj: ${farms.join(' + ') || '0 x0'}`, 'Subject To'];
  let n = 0;
  for (const list of cells.values()) if (list.length > 1) lines.push(` c${n++}: ${list.map(v).join(' + ')} <= 1`);
  lines.push(` w: ${wds.join(' + ')} = ${woods}`);
  lines.push(` g: ${bg.join(' + ')} = ${bigs}`);
  lines.push('Binary', ` ${cands.map((_, i) => v(i)).join(' ')}`, 'End');
  const r = highs.solve(lines.join('\n'));
  if (r.Status !== 'Optimal') return null;
  const chosen = cands.filter((_, i) => r.Columns[v(i)].Primal > 0.5);
  return { farmland: chosen.filter((p) => p.kind === 'farmland').length, woodland: woods, big: bigs, plots: chosen.map(({ kind, x, y }) => ({ kind, x, y })) };
}

const out = {};
for (const b of [1, 2]) {
  const frontier = [];
  for (let g = 0; ; g++) {
    let any = false;
    for (let w = 0; ; w++) {
      let best = null;
      for (const off of OFFSETS) {
        const s = solve(b, off, w, g);
        if (s && (!best || s.farmland > best.farmland)) best = s;
      }
      if (!best) break;
      any = true;
      frontier.push(best);
      console.log(`appareil ${b}×${b} : ${g} grande(s), ${w} Pépinière(s) → ${best.farmland} Fermes`);
    }
    if (!any) break;
  }
  // On ne garde que les mélanges non dominés (pas de mélange au moins aussi bon partout).
  out[String(b)] = frontier.filter(
    (p) => !frontier.some((q) => q !== p && q.farmland >= p.farmland && q.woodland >= p.woodland && q.big >= p.big && (q.farmland > p.farmland || q.woodland > p.woodland || q.big > p.big)),
  );
}
await writeFile(
  join(ROOT, 'data/climate-layouts.json'),
  JSON.stringify({ source: 'Règles de couverture : Aniimax (MIT), src/coverage.rs ; calcul AniiGuide', radius: R, sizes: { farmland: FARM, woodland: WOOD, big: BIG }, devices: { 'heat-furnace': 1, sunlamp: 1, 'cooling-unit': 2 }, layouts: out }) + '\n',
);
console.log('data/climate-layouts.json');
