#!/usr/bin/env node
// Mode électrique du Logis (dès le niveau 12) : durée d'un lot de chaque recette quand
// l'installation tourne sur le réseau, sans Aniimo. Relevé sur Wikily (wikily.gg, API publique du
// tableau « homeland-formulas », données du client du jeu), rattaché à nos recettes par
// installation et objet produit. La puissance consommée par niveau d'installation est déjà dans
// data/homeland/facility-levels.json.
//
// Usage : node scripts/fetch-emode.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://wikily.gg/api/wikis/aniimo/datasets/homeland-formulas/list';
const UA = 'Mozilla/5.0 (AniiGuide; +https://arthurroux99.github.io/AniiGuide/)';

const rows = [];
for (let offset = 0; ; offset += 120) {
  const res = await fetch(`${API}?locale=en&limit=120&offset=${offset}`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`homeland-formulas : HTTP ${res.status}`);
  const j = await res.json();
  rows.push(...j.rows);
  if (!j.rows.length || rows.length >= j.totalCount) break;
}

const homeland = JSON.parse(await readFile(join(ROOT, 'data/homeland/aniimax.json'), 'utf8'));
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
const itemByName = new Map(Object.entries(homeland.items).map(([id, it]) => [norm(it.name), id]));
const facilityByName = new Map(homeland.facilities.map((f) => [norm(f.name), f.id]));
// Même objet, nom anglais différent chez Aniimax et dans le jeu.
const ALIASES = { plainfreshwater: 'fresh_water', naturalmineralspring: 'natural_mineral_spring_water', naturalmineralwater: 'natural_mineral_spring_water', freshwater: 'fresh_water', umbralsweetspicysauce: 'umbral_sweet_and_spicy_sauce' };

const seconds = {};
const missing = [];
for (const { data: d } of rows) {
  if (d.mode !== 'E-mode' || !d.time_seconds) continue;
  const facility = facilityByName.get(norm(d.made_at));
  let name = norm(d.name);
  const quick = name.startsWith('quickrecipe');
  name = name.replace(/^quickrecipe/, '');
  const base = ALIASES[name] ?? itemByName.get(name);
  // Recettes rapides (module) : objet « quick_… » chez Aniimax.
  const item = quick ? `quick_${base}` : base;
  const recipe = homeland.recipes.find((r) => r.facility === facility && r.output.item === item && r.kind !== 'grower');
  if (!recipe) missing.push(`${d.made_at} · ${d.name}`);
  else seconds[recipe.id] = d.time_seconds;
}
if (Object.keys(seconds).length < 120) throw new Error(`homeland-formulas : seulement ${Object.keys(seconds).length} recettes électriques, structure changée ?`);

const out = {
  source: 'https://wikily.gg/aniimo/homeland-crafting (données du client du jeu)',
  fetchedAt: new Date().toISOString(),
  // Générateur crépitant (niveaux 1 à 5, débloqués aux niveaux 12, 14, 16, 18, 20 du Camping-car) :
  // puissance produite et niveau Foudre demandé à l'Aniimo qui y travaille.
  generator: { power: [600, 800, 1000, 1200, 1500], lightning: [1, 2, 3, 3, 3], rv: [12, 14, 16, 18, 20] },
  seconds: Object.fromEntries(Object.entries(seconds).sort(([a], [b]) => a.localeCompare(b))),
};
await writeFile(join(ROOT, 'data/homeland/emode.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`data/homeland/emode.json : ${Object.keys(seconds).length} recettes électriques${missing.length ? ` ; non rattachées : ${missing.join(', ')}` : ''}`);
