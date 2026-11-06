#!/usr/bin/env node
// Saison du Logis en cours : « Nuit des Merveilles » (Magical Wonder Night), du 29 octobre au
// 10 décembre 2026 03:59 (UTC+8). Aniimax n'a pas (encore) cette saison : on relève les recettes
// sur Wikily (wikily.gg, données du client du jeu : entrées, charge de travail, capacité, durée en
// mode électrique, prix de vente, noms FR) et on complète avec ce que Wikily ne donne pas :
// niveau d'installation, graines, Notes de recette (guides aniimoguide.com et gamewith.ai,
// recoupés).
//
// Usage : node scripts/fetch-season.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://wikily.gg/api/wikis/aniimo/datasets';
const UA = 'Mozilla/5.0 (AniiGuide; +https://arthurroux99.github.io/AniiGuide/)';

const SEASON = {
  id: 'magical-wonder-night',
  name: 'Nuit des Merveilles',
  // Fin : 10/12/2026 03:59 UTC+8.
  ends: '2026-12-09T19:59:00Z',
  minHomeLevel: 10,
  currency: 'Weird Jelly Beans',
  // Au moins 1 400 par jour : 4 quotidiennes de la saison (200 chacune) + 2 commandes de saison (300 à 500).
  currencyPerDay: 1400,
  // Points de Fantaisie (Whimsy) : seules les récoltes sont connues (+1 par fruit récolté) ; ceux
  // des plats ne sont publiés nulle part, donc pas d'objectif « points » pour cette saison.
  pointsKnown: false,
  crops: {
    magic_pumpkin: { name: 'Magic Pumpkin', seed: 4, points: 1 },
    memory_lanternfruit: { name: 'Memory Lanternfruit', seed: 4, points: 1 },
  },
  // Niveau d'installation demandé ; `note` : recette débloquée par une Note de recette de la boutique
  // de saison (80 à 120 Weird Jelly Beans). Les deux autres sont offertes au début de la saison.
  dishes: {
    sea_salt_roasted_pumpkin: { name: 'Sea Salt Roasted Pumpkin', level: 4, note: false },
    candied_lanternfruit: { name: 'Candied Lanternfruit', level: 2, note: false },
    magic_pumpkin_lantern: { name: 'Magic Pumpkin Lantern', level: 4, note: true },
    memory_lantern: { name: 'Memory Lantern', level: 4, note: true },
    magic_pumpkin_cake: { name: 'Magic Pumpkin Cake', level: 2, note: true },
    gleam_fruit_nectar: { name: 'Gleam Fruit Nectar', level: 2, note: true },
    honey_glazed_pumpkin_cup: { name: 'Honey-Glazed Pumpkin Cup', level: 2, note: true },
    golden_lantern_pumpkin_soup: { name: 'Golden Lantern Pumpkin Soup', level: 3, note: true },
    glowfruit_lantern_set: { name: 'Glowfruit Lantern Set', level: 5, note: true },
  },
  // Commandes de saison (2 par jour, tirées parmi celles-ci) : quantité demandée, récompense en
  // Weird Jelly Beans et en Pièces de logis (guide aniimoguide.com, relevé en jeu).
  orders: [
    { item: 'sea_salt_roasted_pumpkin', qty: 3, beans: 300, coins: 14160 },
    { item: 'candied_lanternfruit', qty: 2, beans: 300, coins: 18080 },
    { item: 'magic_pumpkin_lantern', qty: 6, beans: 300, coins: 15600 },
    { item: 'memory_lantern', qty: 3, beans: 300, coins: 14640 },
    { item: 'magic_pumpkin_cake', qty: 3, beans: 300, coins: 13440 },
    { item: 'gleam_fruit_nectar', qty: 3, beans: 300, coins: 14160 },
    { item: 'honey_glazed_pumpkin_cup', qty: 2, beans: 500, coins: 35440 },
    { item: 'golden_lantern_pumpkin_soup', qty: 2, beans: 500, coins: 14640 },
    { item: 'glowfruit_lantern_set', qty: 3, beans: 500, coins: 36585 },
  ],
};

// Saison terminée : on garde le dernier relevé (le site la masque après sa date de fin).
if (Date.now() > Date.parse(SEASON.ends)) {
  console.log(`${SEASON.name} terminée : data/homeland/season.json inchangé`);
  process.exit(0);
}

async function all(dataset, locale) {
  const rows = [];
  for (let offset = 0; ; offset += 120) {
    const res = await fetch(`${API}/${dataset}/list?locale=${locale}&limit=120&offset=${offset}`, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${dataset} ${locale} : HTTP ${res.status}`);
    const j = await res.json();
    rows.push(...j.rows);
    if (!j.rows.length || rows.length >= j.totalCount) return rows;
  }
}

const homeland = JSON.parse(await readFile(join(ROOT, 'data/homeland/aniimax.json'), 'utf8'));
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
const known = { ...Object.fromEntries(Object.entries(SEASON.crops).map(([id, c]) => [norm(c.name), id])), ...Object.fromEntries(Object.entries(SEASON.dishes).map(([id, d]) => [norm(d.name), id])) };
const itemId = (name) => known[norm(name)] ?? (norm(name) === 'plainfreshwater' ? 'fresh_water' : Object.entries(homeland.items).find(([, it]) => norm(it.name) === norm(name))?.[0]);
const facilityId = (name) => homeland.facilities.find((f) => norm(f.name) === norm(name))?.id;
const parseInputs = (s) =>
  s.split('·').map((part) => {
    const m = part.trim().match(/^(.*?)(?:\s*×(\d+))?$/);
    const item = itemId(m[1]);
    if (!item) throw new Error(`objet inconnu : ${m[1]}`);
    return { item, qty: Number(m[2] ?? 1) };
  });

const [formulasEn, formulasFr, market] = await Promise.all([all('homeland-formulas', 'en'), all('homeland-formulas', 'fr'), all('homeland-market', 'en')]);
const frByKey = new Map(formulasFr.map((r) => [r.key, r.data.name]));
const price = new Map(market.map((r) => [norm(r.data.name ?? ''), r.data.price]));

const recipes = [];
const items = {};
const names = {};
const seconds = {};
// Tâches d'une culture de 40 min (défricher, semer, récolter), comme les autres cultures de Ferme.
const steps = homeland.recipes.find((r) => r.id === 'farmland:lavender').steps;

for (const [id, c] of Object.entries(SEASON.crops)) {
  const row = formulasEn.find((r) => norm(r.data.name) === norm(c.name) && r.data.made_at === 'Farmland');
  if (!row) throw new Error(`culture absente de Wikily : ${c.name}`);
  const qty = Number(row.data.output.match(/×(\d+)/)?.[1] ?? 1);
  recipes.push({
    id: `farmland:${id}`,
    facility: 'farmland',
    kind: 'grower',
    level: 5,
    output: { item: id, qty },
    inputs: [],
    module: null,
    // Culture « Adéquat » : sous Lampe solaire, comme les autres cultures de Ferme niveau 5.
    environment: 'Adequate',
    verified: true,
    season: true,
    seconds: row.data.time_seconds,
    seedCost: 0,
    seedWheat: c.seed,
    steps,
  });
  items[id] = { name: c.name, sellValue: price.get(norm(c.name)) ?? 0, currency: 'coins', points: c.points };
  names[id] = frByKey.get(row.key);
}

for (const [id, d] of Object.entries(SEASON.dishes)) {
  const work = formulasEn.find((r) => norm(r.data.name) === norm(d.name) && r.data.workload);
  const elec = formulasEn.find((r) => norm(r.data.name) === norm(d.name) && r.data.time_seconds);
  if (!work || !elec) throw new Error(`recette absente de Wikily : ${d.name}`);
  const facility = facilityId(work.data.made_at);
  if (!facility) throw new Error(`installation inconnue : ${work.data.made_at}`);
  const [ability, level] = work.data.abilities.split(' Lv ');
  // Les quantités du mode électrique sont complètes (« Magic Pumpkin ×8 ») ; celles du mode Aniimo
  // oublient parfois le ×8 de la Citrouille magique.
  const recipe = {
    id: `${facility}:${id}`,
    facility,
    kind: 'processor',
    level: d.level,
    output: { item: id, qty: 1 },
    inputs: parseInputs(elec.data.inputs),
    module: null,
    environment: null,
    verified: true,
    season: true,
    workload: work.data.workload,
    ability: ability.toLowerCase(),
    abilityLevel: Number(level),
  };
  recipes.push(recipe);
  seconds[recipe.id] = elec.data.time_seconds;
  items[id] = { name: d.name, sellValue: price.get(norm(d.name)) ?? 0, currency: 'coins', points: 0 };
  names[id] = frByKey.get(work.key);
}
if (Object.values(items).some((it) => !it.sellValue)) throw new Error('prix de vente manquant');

const out = {
  source: 'https://wikily.gg/aniimo/homeland-crafting (données du client du jeu) ; niveaux, graines et Notes : aniimoguide.com, gamewith.ai',
  fetchedAt: new Date().toISOString(),
  season: {
    id: SEASON.id,
    name: SEASON.name,
    ends: SEASON.ends,
    minHomeLevel: SEASON.minHomeLevel,
    currency: SEASON.currency,
    currencyPerDay: SEASON.currencyPerDay,
    pointsKnown: SEASON.pointsKnown,
    orders: SEASON.orders,
    recipeNotes: recipes.filter((r) => SEASON.dishes[r.output.item]?.note).map((r) => r.id),
  },
  recipes,
  items,
  names,
  emode: seconds,
};
await writeFile(join(ROOT, 'data/homeland/season.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`data/homeland/season.json : ${recipes.length} recettes de la ${SEASON.name}`);
