#!/usr/bin/env node
// Relève les tier lists de combat publiées par la communauté et les écrit dans
// data/tierlists/<source>.json : rang de chaque Aniimo, rattaché à nos fiches officielles.
//
// Usage : node scripts/fetch-tierlists.mjs
//
// On ne reprend que le classement (qui est où), avec le nom et le lien de la source ; pas les
// textes. Chaque site a sa propre mise en page, d'où un lecteur par source. Les Aniimo dont la
// forme n'existe pas dans nos données (ex. « Umbrabow ») sont listés à part dans `unmatched`.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const official = JSON.parse(await readFile(join(ROOT, 'data/official/aniimo.json'), 'utf8')).entries;

// Espèces classées par la communauté mais absentes du wiki officiel (au 27/09/2026).
const EXTRA_SPECIES = [
  'Somniwing', 'Irisalis', 'Helion', 'Sparkelf', 'Soleon', 'Fennelun', 'Hexxin', 'Malevsera', 'Coraliz', 'Glameep',
  'Gachapus', 'Popapus', 'Wavwal', 'Bubbeep', 'Cheekie', 'Malangel', 'Reefish',
];
const BASE_NAMES = new Set([...official.map((e) => e.name.en), ...EXTRA_SPECIES]);
const FORMS = new Set(official.map((e) => e.form));
const entryFor = new Map(official.map((e) => [`${e.name.en}|${e.form}`, e.id]));
// Espèces dont le wiki n'a qu'une seule fiche (ex. Somniwing = Vitti, seulement en forme prismana) :
// le nom seul désigne cette fiche.
for (const name of new Set(official.map((e) => e.name.en))) {
  const forms = official.filter((e) => e.name.en === name);
  if (forms.length === 1 && !entryFor.has(`${name}|Basic Form`)) entryFor.set(`${name}|Basic Form`, forms[0].id);
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Le texte de la page, découpé en morceaux (textes et textes alternatifs d'images), dans l'ordre. */
function tokens(html) {
  const body = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const out = [];
  for (const m of body.matchAll(/<img[^>]*alt="([^"]*)"|>([^<]+)</gi)) {
    const t = decode(m[1] ?? m[2] ?? '').replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

/** « Glacy (Prismana Form) », « Prismana Glacy », « Budclaw. » → { base, form } ou null. */
function parseName(raw) {
  const t = raw.replace(/\.$/, '').replace(/^Aniimo /, '').trim();
  const paren = t.match(/^(.+?)\s*\((.+?)\)$/);
  if (paren && BASE_NAMES.has(paren[1])) {
    const f = paren[2].replace(/\bform\b/i, 'Form').trim();
    return { base: paren[1], form: /Form$/.test(f) ? f : `${f} Form` };
  }
  if (BASE_NAMES.has(t)) return { base: t, form: 'Basic Form' };
  for (const form of FORMS) {
    const prefix = form.replace(/ Form$/, '');
    if (t.startsWith(prefix + ' ') && BASE_NAMES.has(t.slice(prefix.length + 1))) return { base: t.slice(prefix.length + 1), form };
  }
  return null;
}

/** Lit une suite « palier puis noms » entre deux bornes. */
function readTiers(toks, { start, stop, isTier, tierOf = (t) => t }) {
  const out = [];
  let tier = null;
  for (let i = start; i < toks.length; i++) {
    const t = toks[i];
    if (stop(t, i)) break;
    if (isTier(t)) {
      tier = tierOf(t);
      continue;
    }
    const n = tier && parseName(t);
    if (n) out.push({ ...n, tier });
  }
  return out;
}

const SOURCES = [
  {
    id: 'game8',
    name: 'Game8',
    url: 'https://game8.co/games/Aniimo/archives/621098',
    scale: ['S', 'A', 'B', 'C', 'D'],
    read(toks) {
      const start = toks.indexOf('Best Aniimo Explanations');
      return readTiers(toks, {
        start,
        isTier: (t) => /^[SABCD] Tier$/.test(t),
        tierOf: (t) => t[0],
        stop: (t, i) => i > start + 5 && /^(Aniimo Related Guides|Related Guides|Comment)/.test(t),
      });
    },
  },
  {
    id: 'mobi',
    name: 'Mobi.gg',
    url: 'https://mobi.gg/en/tips/aniimo-tier-list/',
    scale: ['S+', 'S', 'A', 'B'],
    read(toks) {
      const start = toks.findIndex((t, i) => t === 'S+' && i > 0 && /beginners/.test(toks[i - 1]));
      return readTiers(toks, { start, isTier: (t) => ['S+', 'S', 'A', 'B'].includes(t), stop: (t, i) => i > start && t.length > 80 });
    },
  },
  {
    id: 'aniidex',
    name: 'Aniidex',
    url: 'https://aniidex.com/tier-list/',
    scale: ['S', 'A', 'B', 'C', 'D'],
    read(toks) {
      const start = toks.indexOf('Overall');
      return readTiers(toks, {
        start,
        isTier: (t) => /^[SABCD]$/.test(t),
        stop: (t, i) => i > start + 10 && (t.startsWith('Why each') || /^\d+ Aniimo$/.test(t)),
      }).filter((_, i, all) => all.findIndex((x) => x.base === all[i].base && x.form === all[i].form) === i);
    },
  },
  {
    id: 'hideout',
    name: 'Hideout Guides (Lex)',
    url: 'https://www.hideoutgacha.com/games/aniimo/tier-list',
    scale: ['S', 'A', 'B', 'C', 'D'],
    // La page embarque sa liste en JSON ({ name, form, …, tier }) : plus fiable que le texte affiché.
    // « tier: null » = Aniimo pas (encore) classé par l'auteur : ignoré.
    read(_toks, html) {
      const json = html.replace(/\\"/g, '"');
      const out = [];
      for (const m of json.matchAll(/"slug":"[^"]*","name":"([^"]+)"(?:,"form":"([^"]*)")?[^{}]*?"tier":"([SABCD])"/g)) {
        const form = !m[2] || m[2] === '$undefined' || m[2] === 'Basic' ? 'Basic Form' : `${m[2]} Form`;
        if (!BASE_NAMES.has(m[1]) || !FORMS.has(form)) continue;
        if (!out.some((x) => x.base === m[1] && x.form === form)) out.push({ base: m[1], form, tier: m[3] });
      }
      return out;
    },
  },
  {
    id: 'oslink',
    name: 'OSLink',
    url: 'https://www.oslink.io/blog/guide/aniimo-tier-list.html',
    scale: ['SS', 'S', 'A', 'B'],
    read(toks) {
      // Tableau récapitulatif : « SS tier » puis « Somniwing, Irisalis, … ».
      const out = [];
      for (let i = 0; i < toks.length - 1; i++) {
        const m = toks[i].match(/^(SS|S|A|B) tier$/i);
        if (!m || !toks[i + 1].includes(',')) continue;
        for (const raw of toks[i + 1].split(',')) {
          const n = parseName(raw.trim());
          if (n && !out.some((x) => x.base === n.base && x.form === n.form)) out.push({ ...n, tier: m[1].toUpperCase() });
        }
      }
      return out;
    },
  },
];

async function fetchText(url) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
  const res = await fetch(url, { headers: { 'user-agent': ua, 'accept-language': 'en' } });
  const text = res.ok ? await res.text() : '';
  if (text.length > 1000) return text;
  // Certains sites (Game8) renvoient une page vide à ce client HTTP : on repasse par curl.
  return execFileSync('curl', ['-sSL', '--compressed', '-A', ua, url], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

await mkdir(join(ROOT, 'data/tierlists'), { recursive: true });
for (const s of SOURCES) {
  try {
    const html = await fetchText(s.url);
    const date = html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    const rows = s.read(tokens(html), html);
    const entries = [];
    const unmatched = [];
    for (const r of rows) {
      // Aniimo ou forme absents du wiki officiel : gardés sous leur nom anglais (id « en: »).
      const id = entryFor.get(`${r.base}|${r.form}`) ?? `en:${r.base}${r.form === 'Basic Form' ? '' : ` (${r.form})`}`;
      if (!id.startsWith('en:') || BASE_NAMES.has(r.base)) {
        if (!entries.some((e) => e.id === id)) entries.push({ id, tier: r.tier });
      }
      if (id.startsWith('en:')) unmatched.push(`${r.base} (${r.form}) : ${r.tier}`);
    }
    // Page bloquée ou changée (ex. Game8 refuse les serveurs de GitHub) : on garde l'ancien relevé.
    const previous = await readFile(join(ROOT, `data/tierlists/${s.id}.json`), 'utf8').then(JSON.parse).catch(() => null);
    if (previous && entries.length < previous.entries.length * 0.5) {
      console.warn(`${s.name} : seulement ${entries.length} classés contre ${previous.entries.length} avant — relevé précédent conservé`);
      continue;
    }
    const out = { source: s.name, url: s.url, note: s.note ?? null, pageDate: date, fetchedAt: new Date().toISOString(), scale: s.scale, entries, unmatched };
    await writeFile(join(ROOT, `data/tierlists/${s.id}.json`), JSON.stringify(out, null, 1) + '\n');
    const byTier = Object.fromEntries(s.scale.map((t) => [t, entries.filter((e) => e.tier === t).length]));
    console.log(`${s.name.padEnd(22)} ${entries.length} classés ${JSON.stringify(byTier)}${unmatched.length ? `, ${unmatched.length} formes inconnues` : ''}`);
  } catch (err) {
    console.warn(`${s.name} : échec (${err.message}) — fichier précédent conservé`);
  }
}
