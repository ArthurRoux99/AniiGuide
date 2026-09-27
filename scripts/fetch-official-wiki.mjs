#!/usr/bin/env node
// Récupère toutes les fiches Aniimo (y compris les formes) du wiki officiel
// https://wiki.aniimo.com en français et en anglais, et écrit data/official/aniimo.json.
//
// Usage : node scripts/fetch-official-wiki.mjs [--delay 400]
//
// Le wiki officiel est une app Nuxt : chaque page embarque ses données dans
// <script id="__NUXT_DATA__">, un tableau JSON « dévalué » où les objets
// référencent d'autres cases par leur index. On le reconstruit puis on garde
// seulement ce dont AniiGuide a besoin (identité, éléments, stats, habitats,
// compétences du Foyer).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://wiki.aniimo.com';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/official/aniimo.json');
const delayArg = process.argv.indexOf('--delay');
const DELAY_MS = delayArg > 0 ? Number(process.argv[delayArg + 1]) : 400;

// Codes « home-XXXX » du wiki → compétence du Foyer. Les couleurs et icônes du
// sprite officiel (images/sprite/attributes.png et home.png) donnent la
// correspondance ; les noms FR sont ceux du jeu.
export const HOMELAND_ABILITIES = {
  'home-1000': { id: 'fire', fr: 'Feu', en: 'Fire' },
  'home-1001': { id: 'grass', fr: 'Plante', en: 'Grass' },
  'home-1002': { id: 'water', fr: 'Eau', en: 'Water' },
  'home-1003': { id: 'earth', fr: 'Terre', en: 'Earth' },
  'home-1004': { id: 'lightning', fr: 'Foudre', en: 'Lightning' },
  'home-1005': { id: 'ice', fr: 'Glace', en: 'Ice' },
  'home-1006': { id: 'wind', fr: 'Vent', en: 'Wind' },
  'home-1007': { id: 'dark', fr: 'Ténèbres', en: 'Dark' },
  'home-1008': { id: 'light', fr: 'Lumière', en: 'Light' },
  'home-1100': { id: 'hauling', fr: 'Transport', en: 'Hauling' },
  'home-1101': { id: 'artisanship', fr: 'Artisanat', en: 'Artisanship' },
  'home-1102': { id: 'leisure', fr: 'Loisir', en: 'Leisure' },
  'home-1103': { id: 'perfumery', fr: 'Parfumerie', en: 'Perfumery' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function fetchPayload(lang, entryId, morphology) {
  const url = `${ORIGIN}/${lang}/item/${entryId}/${slugify(morphology)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'AniiGuide data sync (fan project)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const html = await res.text();
      const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) throw new Error(`Pas de __NUXT_DATA__ sur ${url}`);
      return reviveNuxt(JSON.parse(m[1]));
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

// Reconstruit l'objet racine d'un payload Nuxt « devalue ».
function reviveNuxt(table) {
  const cache = new Map();
  const wrappers = new Set(['ShallowReactive', 'Reactive', 'Ref', 'ShallowRef', 'EmptyRef', 'EmptyShallowRef']);
  const revive = (i) => {
    if (cache.has(i)) return cache.get(i);
    const v = table[i];
    let out;
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && wrappers.has(v[0])) out = revive(v[1]);
      else {
        out = [];
        cache.set(i, out);
        for (const x of v) out.push(typeof x === 'number' ? revive(x) : x);
      }
    } else if (v && typeof v === 'object') {
      out = {};
      cache.set(i, out);
      for (const [k, x] of Object.entries(v)) out[k] = typeof x === 'number' ? revive(x) : x;
    } else out = v;
    cache.set(i, out);
    return out;
  };
  return revive(0);
}

function detailOf(root) {
  const data = root.data || {};
  const key = Object.keys(data).find((k) => k.startsWith('aniimo-detail-'));
  return key ? data[key] : null;
}

function* walk(components) {
  for (const c of components || []) {
    yield c;
    yield* walk(c.children);
    for (const tab of c.props?.tabs || []) yield* walk(tab.children);
  }
}

// Extrait les composants placés sous un titre de section (crumbTitle).
function section(detail, title) {
  for (const dir of detail.directories || []) {
    for (const c of walk(dir.components)) {
      if (c.type === 'crumbTitle' && c.props?.title === title) return c;
    }
  }
  return null;
}

function circles(detail, title) {
  const s = section(detail, title);
  if (!s) return [];
  return [...walk(s.children)]
    .filter((c) => c.type === 'circle' && c.props?.descTitle)
    .map((c) => ({ name: c.props.descTitle, description: c.props.descContent, icon: c.props.icon || null }));
}

function parse(detail) {
  const info = [...walk(detail.directories?.[0]?.components)].find((c) => c.type === 'aniimoInfo')?.props?.formData || {};
  const homeland = [];
  for (const c of walk(section(detail, 'Homeland Ability')?.children)) {
    const key = c.props?.customKey;
    if (!key) continue;
    const ability = HOMELAND_ABILITIES[key];
    if (!ability) console.warn(`Compétence du Foyer inconnue : ${key}`);
    homeland.push({ ability: ability?.id ?? key, level: Number(c.props.title) || null });
  }
  const habitats = [...walk(section(detail, 'Habitats')?.children)]
    .filter((c) => c.type === 'capsule' && c.props?.title)
    .map((c) => c.props.title.replace(/\.$/, '').trim());
  const evo = [...walk(section(detail, 'Evolution')?.children)].find((c) => c.type === 'evolution')?.props?.data;
  return {
    name: info.name,
    description: info.desc,
    image: info.noGenderImage || info.maleImage || detail.searchKey?.imageUrl,
    video: info.illustrationImage || null,
    elements: (info.attributes || []).map((a) => a.replace('attributes-', '')),
    roles: (info.position || []).map((p) => p.replace('position-', '')),
    stats: {
      total: info.attributeValue,
      hp: info.hp,
      physicalAttack: info.physicalAttack,
      magicAttack: info.magicAttack,
      physicalDefense: info.physicalDefense,
      magicDefense: info.magicDefense,
      haste: info.haste,
    },
    weight: { min: info.weightMin, max: info.weightMax },
    genders: info.gender || [],
    habitats,
    homeland,
    mobility: circles(detail, 'Mobility'),
    traits: circles(detail, 'Trait'),
    evolution: evo ? simplifyEvolution(evo) : null,
  };
}

function simplifyEvolution(node) {
  return {
    name: node.name,
    icon: node.icon,
    stage: node.stage,
    conditions: node.condition?.list || [],
    variant: !!node.condition?.isVariant,
    children: (node.children || []).map(simplifyEvolution),
  };
}

async function main() {
  // On part de la première fiche et on suit la chaîne « suivante » :
  // elle passe par toutes les espèces et toutes leurs formes.
  let anchor = { entryId: '001', currentMorphology: 'Basic Form' };
  const seen = new Set();
  const entries = [];
  while (anchor && !seen.has(`${anchor.entryId}|${anchor.currentMorphology}`)) {
    const key = `${anchor.entryId}|${anchor.currentMorphology}`;
    seen.add(key);
    const fr = detailOf(await fetchPayload('fr', anchor.entryId, anchor.currentMorphology));
    await sleep(DELAY_MS);
    const en = detailOf(await fetchPayload('en', anchor.entryId, anchor.currentMorphology));
    await sleep(DELAY_MS);
    if (!fr || !en) {
      console.warn(`Fiche vide : ${key}`);
      break;
    }
    const pfr = parse(fr);
    const pen = parse(en);
    if (anchor.entryId !== '99998') {
      entries.push({
        id: `${anchor.entryId}-${slugify(anchor.currentMorphology)}`,
        number: anchor.entryId,
        form: anchor.currentMorphology,
        stage: Number(fr.searchKey?.currentStage) || null,
        sortOrder: fr.searchKey?.sortOrder ?? null,
        name: { fr: pfr.name, en: pen.name },
        description: { fr: pfr.description, en: pen.description },
        image: pfr.image,
        headIcon: pfr.evolution ? findIcon(pfr.evolution, pfr.name) : null,
        video: pfr.video,
        elements: pfr.elements,
        roles: pfr.roles,
        stats: pfr.stats,
        weight: pfr.weight,
        genders: pfr.genders,
        habitats: { fr: pfr.habitats, en: pen.habitats },
        homeland: pfr.homeland,
        mobility: pfr.mobility.map((m, i) => ({ fr: m, en: pen.mobility[i] })),
        traits: pfr.traits.map((t, i) => ({ fr: t, en: pen.traits[i] })),
        evolution: pfr.evolution,
      });
      console.log(`${String(entries.length).padStart(3)}  ${anchor.entryId} ${anchor.currentMorphology.padEnd(20)} ${pfr.name} / ${pen.name}  ${pfr.homeland.map((h) => `${h.ability}${h.level}`).join(' ')}`);
    }
    anchor = fr.nextAnchor;
  }
  entries.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ source: ORIGIN, fetchedAt: new Date().toISOString(), homelandAbilities: HOMELAND_ABILITIES, entries }, null, 1) + '\n',
  );
  console.log(`\n${entries.length} fiches écrites dans ${OUT}`);
}

function findIcon(node, name) {
  if (node.name === name) return node.icon;
  for (const c of node.children) {
    const r = findIcon(c, name);
    if (r) return r;
  }
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
