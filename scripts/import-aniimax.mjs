#!/usr/bin/env node
// Importe les données de production du Logis depuis le projet Aniimax (licence MIT,
// https://github.com/ae-bii/aniimax), à une version figée, et les écrit dans
// data/homeland/aniimax.json sous une forme normalisée pour AniiGuide.
//
// Usage : node scripts/import-aniimax.mjs [sha]
//
// Aniimax vérifie ses valeurs en jeu installation par installation ; ce qui n'est pas vérifié est
// listé dans unverified.csv et marqué comme tel ici.

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'ae-bii/aniimax';
const SHA = process.argv[2] || 'c1544149ec162fa7c7bc447c5415103b4eafc62c';
const RAW = `https://raw.githubusercontent.com/${REPO}/${SHA}`;

async function get(path) {
  const res = await fetch(`${RAW}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${path}`);
  return res.text();
}

function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.trim());
  return rows
    .filter((r) => r.trim())
    .map((r) => {
      const cells = r.split(',').map((c) => c.trim());
      return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
    });
}

const num = (v) => (v === '' || v == null ? null : Number(v));
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pretty = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const moduleReq = (v) => {
  if (!v) return null;
  const [id, level] = v.split(':');
  return { id, level: Number(level) };
};

// Fichier CSV → installation, et type de recette.
const FILES = {
  'farmland.csv': ['Farmland', 'grower'],
  'woodland.csv': ['Woodland', 'grower'],
  'mine.csv': ['Mine', 'gatherer'],
  'well.csv': ['Well', 'gatherer'],
  'tidewhisper_sandcastle.csv': ['Tidewhisper Sandcastle', 'gatherer'],
  'dewy_house.csv': ['Dewy House', 'gatherer'],
  'nimbus_bed.csv': ['Nimbus Bed', 'gatherer'],
  'starfall_hammock.csv': ['Starfall Hammock', 'gatherer'],
  'floral_windmill.csv': ['Floral Windmill', 'gatherer'],
  'carousel_mill.csv': ['Carousel Mill', 'processor'],
  'crafting_table.csv': ['Crafting Table', 'processor'],
  'claw_game_cooker.csv': ['Claw Game Cooker', 'processor'],
  'jukebox_dryer.csv': ['Jukebox Dryer', 'processor'],
  'simmering_pot.csv': ['Simmering Pot', 'processor'],
  'phonolfactory_table.csv': ['Phonolfactory Table', 'processor'],
  'bouncy_brew_keg.csv': ['Bouncy Brew Keg', 'processor'],
  'blazing_stove.csv': ['Blazing Stove', 'processor'],
  'pickling_jar.csv': ['Pickling Jar', 'processor'],
  'joy_wheel_loom.csv': ['Joy Wheel Loom', 'processor'],
  'dance_pad_polisher.csv': ['Dance Pad Polisher', 'processor'],
  'aniipod_maker.csv': ['Aniipod Maker', 'processor'],
  'woodworking_bench.csv': ['Woodworking Bench', 'processor'],
  'chimney_kiln.csv': ['Chimney Kiln', 'processor'],
};
const BYPRODUCT = { Woodland: 'wood_block', Mine: 'mineral_sand' };
const ABILITY_IDS = {
  Fire: 'fire', Grass: 'grass', Water: 'water', Earth: 'earth', Lightning: 'lightning', Ice: 'ice', Wind: 'wind',
  Dark: 'dark', Light: 'light', Hauling: 'hauling', Artisanship: 'artisanship', Leisure: 'leisure', Perfumery: 'perfumery',
};
const PERSONALITY_LETTER = {
  Instinctive: 'I', Energetic: 'E', Nimble: 'N', Practical: 'S', Faithful: 'F', Tenacious: 'T', Playful: 'P', Judicious: 'J',
};

const requirements = new Map(
  parseCsv(await get('data/aniimo_requirements.csv')).map((r) => [`${r.facility}|${r.name}`, { ability: ABILITY_IDS[r.ability], level: Number(r.min_level) }]),
);
const unverified = new Set(parseCsv(await get('data/unverified.csv')).map((r) => r.name));
const growerSteps = {};
for (const r of parseCsv(await get('data/grower_steps.csv'))) {
  (growerSteps[r.name] ??= []).push({ step: r.step, ability: ABILITY_IDS[r.ability], level: Number(r.min_level), workload: Number(r.workload) });
}

const items = {};
const recipes = [];
const addItem = (id, sell, currency) => {
  items[id] ??= { name: pretty(id), sellValue: 0, currency: 'none' };
  if (sell != null && sell > 0 && (currency ?? 'coins') !== 'none') Object.assign(items[id], { sellValue: sell, currency: currency || 'coins' });
};

for (const [file, [facility, kind]] of Object.entries(FILES)) {
  for (const r of parseCsv(await get(`data/${file}`))) {
    const req = requirements.get(`${facility}|${r.name}`) ?? null;
    addItem(r.name, num(r.sell_value), r.sell_currency || 'coins');
    const recipe = {
      id: `${slug(facility)}:${r.name}`,
      facility: slug(facility),
      kind,
      level: Number(r.facility_level),
      output: { item: r.name, qty: num(r.yield) ?? 1 },
      inputs: [],
      module: moduleReq(r.module_requirement),
      environment: r.environment || null,
      verified: !unverified.has(r.name),
    };
    if (kind === 'grower') {
      recipe.seconds = Number(r.production_time);
      recipe.seedCost = num(r.cost) ?? 0;
      recipe.steps = growerSteps[r.name] ?? [];
    } else {
      recipe.workload = Number(r.workload);
      recipe.ability = req?.ability ?? null;
      recipe.abilityLevel = req?.level ?? 1;
    }
    if (kind === 'processor') {
      const mats = r.raw_materials.split(';');
      const qtys = r.required_amount.split(';').map(Number);
      recipe.inputs = mats.map((m, i) => ({ item: m, qty: qtys[i] }));
      for (const m of mats) addItem(m);
    }
    const by = num(r.byproduct_yield);
    if (by && BYPRODUCT[facility]) {
      recipe.byproduct = { item: BYPRODUCT[facility], qty: by };
      addItem(BYPRODUCT[facility]);
    }
    recipes.push(recipe);
  }
}

// Saison : la Lune des moissons (dès le niveau 10). Graines payées en Blé de lune (pas en pièces),
// et chaque objet de saison vendu rapporte des points en plus de ses pièces. Quelques recettes
// demandent une Note de recette (SEASON.recipeNotes).
const seasonRows = parseCsv(await get('data/harvest_moon_festival.csv'));
for (const r of seasonRows) {
  const facility = r.facility;
  const kind = facility === 'Farmland' ? 'grower' : 'processor';
  const req = requirements.get(`${facility}|${r.name}`) ?? null;
  addItem(r.name, num(r.sell_value), 'coins');
  items[r.name].points = num(r.points) ?? 0;
  const recipe = {
    id: `${slug(facility)}:${r.name}`,
    facility: slug(facility),
    kind,
    level: Number(r.facility_level),
    output: { item: r.name, qty: num(r.yield) ?? 1 },
    inputs: [],
    module: null,
    environment: null,
    verified: !unverified.has(r.name),
    season: true,
  };
  if (kind === 'grower') {
    recipe.seconds = Number(r.production_time);
    recipe.seedCost = 0;
    recipe.seedWheat = num(r.seed_cost) ?? 0;
    recipe.steps = growerSteps[r.name] ?? [];
  } else {
    recipe.workload = Number(r.workload);
    recipe.ability = req?.ability ?? null;
    recipe.abilityLevel = req?.level ?? 1;
    const mats = r.raw_materials.split(';');
    const qtys = r.required_amount.split(';').map(Number);
    recipe.inputs = mats.map((m, i) => ({ item: m, qty: qtys[i] }));
    for (const m of mats) addItem(m);
  }
  recipes.push(recipe);
}

// Configuration des installations et du Camping-car (module ES importé tel quel).
const dir = await mkdtemp(join(tmpdir(), 'aniimax-'));
const cfgPath = join(dir, 'facility-config.mjs');
await writeFile(cfgPath, await get('web/facility-config.js'));
const cfg = await import(pathToFileURL(cfgPath).href);

const facilities = cfg.FACILITIES.map((f) => ({
  id: f.slug,
  name: f.name,
  category: f.category,
  hasLevels: f.hasLevels !== false,
  ability: f.ability ? ABILITY_IDS[f.ability] : null,
  personality: f.personality ? PERSONALITY_LETTER[f.personality] : null,
  unlocks: f.unlocks,
  counts: f.counts,
}));

const levelUp = Object.fromEntries(
  Object.entries(cfg.LEVEL_UP_COSTS).map(([rv, c]) => [rv, { coins: c.coins, items: Object.fromEntries(c.items) }]),
);
for (const c of Object.values(levelUp)) for (const id of Object.keys(c.items)) addItem(id);

const out = {
  source: { repo: `https://github.com/${REPO}`, sha: SHA, license: 'MIT', importedAt: new Date().toISOString() },
  facilities,
  recipes,
  items,
  levelUp,
  levelUpChains: cfg.LEVEL_UP_CHAINS,
  moduleMaxLevels: cfg.MODULE_MAX_LEVELS,
  specialRecipes: cfg.SPECIAL_RECIPES.map((s) => `${slug(s.facility)}:${s.name}`),
  season: {
    name: cfg.SEASON.name,
    minHomeLevel: cfg.SEASON.minHomeLevel,
    recipeNotes: cfg.SEASON.recipeNotes.map((n) => recipes.find((r) => r.season && r.output.item === n.name)?.id).filter(Boolean),
  },
};

await mkdir(join(ROOT, 'data/homeland'), { recursive: true });
await writeFile(join(ROOT, 'data/homeland/aniimax.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${facilities.length} installations, ${recipes.length} recettes, ${Object.keys(items).length} objets (aniimax@${SHA.slice(0, 7)})`);
