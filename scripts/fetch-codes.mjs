#!/usr/bin/env node
// Relève les codes cadeaux Aniimo publiés et les écrit dans data/codes.json.
// Deux sources recoupées : AniimoTools (liste structurée : récompenses, date d'ajout, région) et
// Beebom. Un code listé comme expiré par l'une des deux est considéré comme expiré.
//
// Usage : node scripts/fetch-codes.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/codes.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function tokens(html) {
  const body = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const out = [];
  for (const m of body.matchAll(/<img[^>]*alt="([^"]*)"|>([^<]+)</gi)) {
    const t = decode(m[1] ?? m[2] ?? '').replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' } }).catch(() => null);
  const text = res?.ok ? await res.text() : '';
  if (text.length > 1000) return text;
  return execFileSync('curl', ['-sSL', '--compressed', '-A', UA, url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

const isCode = (t) => /^[A-Za-z][A-Za-z0-9]{5,24}$/.test(t);

/** AniimoTools : code, drapeaux (« US only », « New »), « Copy », paires « x20 » / « Glimmer », « Added », date. */
function readAniimoTools(toks) {
  const active = [];
  const expired = [];
  let section = null;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === 'To redeem' || t === 'Active codes') section = 'active';
    if (t === 'Expired codes') section = 'expired';
    if (t === 'Your loot') section = null; // récapitulatif des récompenses : « x250 », « Glimmer »…
    if (section === 'expired' && toks[i + 1] !== 'Expired') continue;
    if (!section || !isCode(t) || !['New', 'US only', 'Used', 'Copy', 'Expired'].includes(toks[i + 1]) && !/^x[\d,]+$/.test(toks[i + 1] ?? '')) continue;
    const entry = { code: t, rewards: [], note: null, added: null };
    let j = i + 1;
    for (; j < toks.length && j < i + 40; j++) {
      const u = toks[j];
      if (/only$/.test(u)) entry.note = u;
      const q = u.match(/^x([\d,]+)$/);
      if (q) entry.rewards.push({ qty: Number(q[1].replace(/,/g, '')), item: toks[j + 1] });
      if (u === 'Added' && /^\d{4}-\d{2}-\d{2}$/.test(toks[j + 1] ?? '')) {
        entry.added = toks[j + 1];
        break;
      }
      if (j > i + 1 && isCode(u) && ['New', 'US only', 'Used', 'Copy', 'Expired'].includes(toks[j + 1])) break;
    }
    (section === 'expired' ? expired : active).push(entry);
    i = j;
  }
  return { active, expired };
}

/** Beebom : « code » puis « : 20 Glimmer ( » ; section « Expired Aniimo Codes ». */
function readBeebom(toks) {
  const active = [];
  const expired = [];
  const start = toks.indexOf('All New Aniimo Codes');
  const stop = toks.indexOf('Expired Aniimo Codes');
  for (let i = start; i > 0 && i < stop; i++) if (isCode(toks[i]) && toks[i + 1]?.startsWith(':')) active.push(toks[i]);
  for (let i = stop + 1; stop > 0 && i < toks.length && isCode(toks[i]); i++) expired.push(toks[i]);
  return { active, expired };
}

const previous = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
const sources = [];
let tools = { active: [], expired: [] };
let beebom = { active: [], expired: [] };
try {
  tools = readAniimoTools(tokens(await fetchText('https://aniimotools.dev/codes/')));
  sources.push({ name: 'AniimoTools', url: 'https://aniimotools.dev/codes/' });
} catch (err) {
  console.warn(`AniimoTools : échec (${err.message})`);
}
try {
  beebom = readBeebom(tokens(await fetchText('https://beebom.com/aniimo-codes/')));
  sources.push({ name: 'Beebom', url: 'https://beebom.com/aniimo-codes/' });
} catch (err) {
  console.warn(`Beebom : échec (${err.message})`);
}

const expiredSet = new Set([...tools.expired.map((e) => e.code), ...beebom.expired].map((c) => c.toLowerCase()));
const byCode = new Map();
for (const e of tools.active) byCode.set(e.code.toLowerCase(), { ...e, sources: ['AniimoTools'] });
for (const c of beebom.active) {
  const k = c.toLowerCase();
  if (byCode.has(k)) byCode.get(k).sources.push('Beebom');
  else byCode.set(k, { code: c, rewards: [], note: null, added: null, sources: ['Beebom'] });
}
// Un code déjà connu garde sa date d'ajout ; un code disparu des deux sources passe en expiré.
const active = [...byCode.values()].filter((e) => !expiredSet.has(e.code.toLowerCase()));
const expired = [
  ...new Map(
    [...tools.expired.map((e) => ({ ...e, sources: ['AniimoTools'] })), ...(previous?.active ?? []).filter((e) => !byCode.has(e.code.toLowerCase()))].map((e) => [e.code.toLowerCase(), e]),
  ).values(),
  ...beebom.expired.filter((c) => !tools.expired.some((e) => e.code.toLowerCase() === c.toLowerCase())).map((c) => ({ code: c, rewards: [], note: null, added: null, sources: ['Beebom'] })),
];

if (!active.length && previous?.active?.length) {
  console.warn('Aucun code relevé : fichier précédent conservé');
} else {
  active.sort((a, b) => (b.added ?? '').localeCompare(a.added ?? '') || a.code.localeCompare(b.code));
  await writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), sources, active, expired }, null, 1) + '\n');
  console.log(`${active.length} codes actifs, ${expired.length} expirés (${sources.map((s) => s.name).join(', ')})`);
}
