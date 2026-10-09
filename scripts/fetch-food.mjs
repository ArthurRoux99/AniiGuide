#!/usr/bin/env node
// Valeur nourrissante de chaque plat du Logis, relevée sur Wikily (wikily.gg/fr/aniimo,
// API publique du tableau « homeland-food »). On ne garde que des faits du jeu : nom officiel,
// valeur nourrissante et installation qui le prépare. Un Aniimo au travail en mange 10 par minute.
//
// Usage : node scripts/fetch-food.mjs

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://wikily.gg/api/wikis/aniimo/datasets/homeland-food/list';
const UA = 'Mozilla/5.0 (AniiGuide; +https://arthurroux99.github.io/AniiGuide/)';

const rows = [];
for (let offset = 0; ; offset += 120) {
  const res = await fetch(`${API}?locale=fr&limit=120&offset=${offset}`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`homeland-food : HTTP ${res.status}`);
  const j = await res.json();
  rows.push(...j.rows);
  if (!j.rows.length || rows.length >= j.totalCount) break;
}

const food = {};
for (const { data: d } of rows) {
  if (!d.food_value) continue;
  // Identifiant de page (« wheat », « lavender-cookies ») → nos identifiants d'objets.
  food[d.slug.replace(/-/g, '_')] = { name: d.name, value: d.food_value, madeAt: d.made_at || null };
}
if (Object.keys(food).length < 40) throw new Error(`homeland-food : seulement ${Object.keys(food).length} plats, structure changée ?`);

const out = {
  source: 'https://wikily.gg/fr/aniimo/homeland-food',
  fetchedAt: new Date().toISOString(),
  perWorkerPerMinute: 10,
  food: Object.fromEntries(Object.entries(food).sort(([a], [b]) => a.localeCompare(b))),
};
await writeFile(join(ROOT, 'data/homeland/food.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`data/homeland/food.json : ${Object.keys(food).length} plats`);
