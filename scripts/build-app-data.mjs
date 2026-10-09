#!/usr/bin/env node
// Génère les données allégées utilisées par l'application (src/data/*.gen.json)
// à partir des données brutes de data/. À relancer après chaque mise à jour des données.

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

// Noms FR des formes, tels qu'affichés par le wiki officiel (morphology-tags-fr).
const FORMS_FR = {
  'Basic Form': 'Forme de base',
  'Prismana Form': 'Forme prismana',
  'Region Form': 'Forme régionale',
  'Cloudmist Form': 'Forme des brumes nuageuses',
  'Nighttime Form': 'Forme de nuit',
  'Towerwood Form': 'Forme de tourbois',
  'Mountain Woods Form': 'Forme des montagnes boisées',
  'Rainstorm Form': 'Forme des déluges',
  'Snowfield Form': 'Forme des neiges',
  'Mudflat Form': 'Forme des vasières',
  'Beach Form': 'Forme des plages',
  'Thunderstorm Form': 'Forme des orages',
  'Mountain Form': 'Forme des montagnes',
  'Grassland Form': 'Forme des prairies',
  'Plateau Form': 'Forme des plateaux',
  'Bay Form': 'Forme des baies',
  'Sea of Flowers Form': 'Forme de la mer florale',
  'Forest Form': 'Forme des forêts',
  'Highland Form': 'Forme des hautes-plaines',
};

const official = await read('data/official/aniimo.json');
const aniimo = official.entries.map((e) => {
  const form = FORMS_FR[e.form];
  if (!form) throw new Error(`Forme sans nom FR : ${e.form}`);
  return {
    id: e.id,
    number: e.number,
    form: e.form === 'Basic Form' ? null : form,
    prismana: e.form === 'Prismana Form',
    stage: e.stage,
    name: e.name.fr,
    nameEn: e.name.en,
    image: e.image,
    head: e.headIcon,
    elements: e.elements,
    roles: e.roles,
    statTotal: e.stats?.total ?? null,
    homeland: Object.fromEntries(e.homeland.map((h) => [h.ability, h.level])),
    // Quelques zones ne sont pas encore traduites sur le wiki (texte chinois, même en anglais) : écartées.
    habitats: e.habitats.fr.filter((h) => !/[\u3400-\u9fff]/.test(h)),
  };
});

await writeFile(join(ROOT, 'src/data/aniimo.gen.json'), JSON.stringify({ fetchedAt: official.fetchedAt, aniimo }) + '\n');
console.log(`src/data/aniimo.gen.json : ${aniimo.length} fiches`);

// Fiches détaillées (chargées à l'ouverture de l'Aniidex seulement).
const skill = (t) => ({ name: t.fr.name, description: t.fr.description, icon: t.fr.icon });
const tree = (n) => n && { name: n.name, icon: n.icon, stage: n.stage, variant: n.variant, children: n.children.map(tree) };
const details = Object.fromEntries(
  official.entries.map((e) => [
    e.id,
    {
      description: e.description.fr,
      stats: e.stats,
      weight: e.weight,
      genders: e.genders,
      traits: e.traits.map(skill),
      mobility: e.mobility.map(skill),
      evolution: tree(e.evolution),
      video: e.video,
    },
  ]),
);
await writeFile(join(ROOT, 'src/data/aniimo-details.gen.json'), JSON.stringify(details) + '\n');
console.log(`src/data/aniimo-details.gen.json : ${Object.keys(details).length} fiches détaillées`);

const homeland = await read('data/homeland/aniimax.json');
const fr = await read('data/i18n/fr.json');
// Noms officiels relevés sur Wikily (scripts/fetch-fr-names.mjs) ; ceux relevés en jeu priment.
const wikily = await read('data/i18n/wikily-fr.json').catch(() => ({ facilities: {}, items: {} }));
await writeFile(
  join(ROOT, 'src/data/homeland.gen.json'),
  JSON.stringify({ ...homeland, names: { facilities: { ...wikily.facilities, ...fr.installations }, items: { ...wikily.items, ...fr.objets } }, levels: (await read('data/homeland/facility-levels.json').catch(() => ({ levels: {} }))).levels, food: Object.fromEntries(Object.entries((await read('data/homeland/food.json').catch(() => ({ food: {} }))).food).map(([id, f]) => [id, f.value])), emode: await read('data/homeland/emode.json').then(({ generator, seconds }) => ({ generator, seconds })).catch(() => null) }) + '\n',
);
console.log(`src/data/homeland.gen.json : ${homeland.recipes.length} recettes`);

const { readdir } = await import('node:fs/promises');
const tierFiles = (await readdir(join(ROOT, 'data/tierlists'))).filter((f) => f.endsWith('.json')).sort();
const tierlists = [];
for (const f of tierFiles) {
  const t = await read(`data/tierlists/${f}`);
  tierlists.push({ id: f.replace(/\.json$/, ''), source: t.source, url: t.url, note: t.note, pageDate: t.pageDate, fetchedAt: t.fetchedAt, scale: t.scale, entries: t.entries });
}
await writeFile(join(ROOT, 'src/data/tierlists.gen.json'), JSON.stringify(tierlists) + '\n');
console.log(`src/data/tierlists.gen.json : ${tierlists.length} sources`);

const profile = await read('data/profils/exemple-rv8.json');
await writeFile(join(ROOT, 'src/data/exemple-rv8.gen.json'), JSON.stringify(profile) + '\n');
console.log('src/data/exemple-rv8.gen.json');

const codes = await read('data/codes.json');
await writeFile(join(ROOT, 'src/data/codes.gen.json'), JSON.stringify(codes) + '\n');
console.log(`src/data/codes.gen.json : ${codes.active.length} codes actifs`);

const combos = await read('data/combos.json');
await writeFile(join(ROOT, 'src/data/combos.gen.json'), JSON.stringify(combos) + '\n');
console.log(`src/data/combos.gen.json : ${combos.combos.length} combos`);

// Placements optimaux autour des appareils climatiques (scripts/build-climate-layouts.mjs).
await copyFile(join(ROOT, 'data/climate-layouts.json'), join(ROOT, 'src/data/climate-layouts.gen.json'));
await copyFile(join(ROOT, 'data/pair-layouts.json'), join(ROOT, 'src/data/pair-layouts.gen.json'));

// Références de reconnaissance des portraits (générées par scripts/build-portraits.mjs).
await copyFile(join(ROOT, 'data/portraits.bin'), join(ROOT, 'src/data/portraits.gen.bin'));
await copyFile(join(ROOT, 'data/portraits.json'), join(ROOT, 'src/data/portraits.gen.json'));
console.log('src/data/portraits.gen.bin');

const eggheist = await read('data/eggheist.json');
await writeFile(join(ROOT, 'src/data/eggheist.gen.json'), JSON.stringify(eggheist) + '\n');
console.log('src/data/eggheist.gen.json');
