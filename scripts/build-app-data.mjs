#!/usr/bin/env node
// Génère les données allégées utilisées par l'application (src/data/*.gen.json)
// à partir des données brutes de data/. À relancer après chaque mise à jour des données.

import { readFile, writeFile } from 'node:fs/promises';
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
    homeland: Object.fromEntries(e.homeland.map((h) => [h.ability, h.level])),
    habitats: e.habitats.fr,
  };
});

await writeFile(join(ROOT, 'src/data/aniimo.gen.json'), JSON.stringify({ fetchedAt: official.fetchedAt, aniimo }) + '\n');
console.log(`src/data/aniimo.gen.json : ${aniimo.length} fiches`);

const profile = await read('data/profils/exemple-rv8.json');
await writeFile(join(ROOT, 'src/data/exemple-rv8.gen.json'), JSON.stringify(profile) + '\n');
console.log('src/data/exemple-rv8.gen.json');
