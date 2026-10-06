#!/usr/bin/env node
// Noms français officiels des objets et installations du Logis, relevés sur Wikily
// (wikily.gg/fr/aniimo, API publique des tableaux « homeland-formulas » et « homeland-market »).
// On ne garde que les noms (repris du jeu), rattachés à nos identifiants d'objets par le nom
// anglais ou l'identifiant de la page. Les noms relevés en jeu (data/i18n/fr.json) restent
// prioritaires.
//
// Usage : node scripts/fetch-fr-names.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://wikily.gg/api/wikis/aniimo/datasets';
const UA = 'Mozilla/5.0 (AniiGuide; +https://arthurroux99.github.io/AniiGuide/)';

async function all(dataset, locale) {
  const rows = [];
  for (let offset = 0; ; offset += 120) {
    const res = await fetch(`${API}/${dataset}/list?locale=${locale}&limit=120&offset=${offset}`, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${dataset} ${locale} : HTTP ${res.status}`);
    const j = await res.json();
    rows.push(...j.rows);
    if (!j.rows.length || rows.length >= j.totalCount) break;
  }
  return rows;
}

const homeland = JSON.parse(await readFile(join(ROOT, 'data/homeland/aniimax.json'), 'utf8'));
const out = { source: 'https://wikily.gg/fr/aniimo/homeland-crafting', fetchedAt: new Date().toISOString(), facilities: {}, items: {} };

// Objets : par identifiant de page (« milled-rice-1234 » → milled_rice) puis par nom anglais.
const fr = new Map(), en = new Map();
for (const dataset of ['homeland-formulas', 'homeland-market']) {
  for (const r of await all(dataset, 'fr')) fr.set(r.key, r.data.name);
  for (const r of await all(dataset, 'en')) en.set(r.key, r.data.name);
}
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const bySlug = new Map([...fr].map(([k, v]) => [k.replace(/-\d+$/, '').replace(/-/g, '_'), v]));
const byEnglish = new Map([...en].map(([k, v]) => [norm(v), fr.get(k)]));
// Même objet, nom anglais différent chez Aniimax et dans le jeu.
const ALIASES = { fresh_water: 'plain_fresh_water', natural_mineral_spring_water: 'natural_mineral_spring' };
const lookup = (id) => bySlug.get(ALIASES[id] ?? id) ?? byEnglish.get(norm(homeland.items[id]?.name ?? ''));
for (const id of Object.keys(homeland.items)) {
  // Les recettes « rapides » produisent le même objet que la recette normale.
  const name = lookup(id) ?? (id.startsWith('quick_') ? lookup(id.slice(6)) : undefined);
  if (name) out.items[id] = name;
}
// Niveaux des installations (données du client du jeu, relevées par Wikily) : stock, puissance
// électrique consommée, coût d'amélioration en Pièces de logis.
const levels = {};
const num = (s) => Number(String(s).replace(/[\s\u202f\u00a0]/g, ''));
for (const r of await all('homeland-facilities', 'fr')) {
  out.facilities[r.key] = r.data.name;
  levels[r.key] = (r.data.levels ?? []).map((l) => ({
    stock: num(l.note.match(/rendement ([\d\s\u202f\u00a0]+)/)?.[1] ?? NaN) || null,
    power: num(l.note.match(/puissance électrique ([\d\s\u202f\u00a0]+)/)?.[1] ?? NaN) || null,
    cost: num(l.note.match(/Pièce de logis ×([\d\s\u202f\u00a0]+)/)?.[1] ?? NaN) || null,
  }));
}

const missing = Object.keys(homeland.items).filter((id) => !out.items[id]);
if (Object.keys(out.items).length < Object.keys(homeland.items).length / 2) {
  console.warn('Relevé incomplet : fichier précédent conservé');
} else {
  await writeFile(join(ROOT, 'data/i18n/wikily-fr.json'), JSON.stringify(out, null, 1) + '\n');
  await writeFile(
    join(ROOT, 'data/homeland/facility-levels.json'),
    JSON.stringify({ source: 'Wikily (données du client du jeu)', url: 'https://wikily.gg/fr/aniimo/homeland-crafting', fetchedAt: out.fetchedAt, levels }, null, 1) + '\n',
  );
  console.log(`data/i18n/wikily-fr.json : ${Object.keys(out.items).length}/${Object.keys(homeland.items).length} objets, ${Object.keys(out.facilities).length} installations`);
  if (missing.length) console.log(`sans nom FR : ${missing.join(', ')}`);
}
