#!/usr/bin/env node
// Prépare les références de reconnaissance des portraits (import d'ouvriers par capture).
// Télécharge le portrait officiel de chaque Aniimo (Wiki_PetHead, ou l'illustration quand il n'y
// en a pas), le réduit selon les cadrages de src/engine/portrait.ts et écrit :
//   data/portraits.bin  : pour chaque fiche et chaque cadrage, SIDE×SIDE pixels RGBA
//   data/portraits.json : ordre des fiches, taille et nombre de cadrages
//
// Usage : node scripts/build-portraits.mjs   (relancé par la mise à jour des données)

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { makeReferences, SIDE, WINDOWS } from '../src/engine/portrait.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const official = JSON.parse(await readFile(join(ROOT, 'data/official/aniimo.json'), 'utf8'));

async function load(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(`Portrait introuvable : ${url}`);
}

const ids = [];
const chunks = [];
const queue = [...official.entries];
async function worker() {
  for (let e = queue.shift(); e; e = queue.shift()) {
    const png = await load(e.headIcon ?? e.image);
    const refs = makeReferences(e.id, { data: png.data, width: png.width, height: png.height });
    const bytes = new Uint8Array(refs.length * SIDE * SIDE * 4);
    refs.forEach((r, w) => {
      for (let p = 0; p < SIDE * SIDE; p++) {
        const o = (w * SIDE * SIDE + p) * 4;
        bytes[o] = Math.round(r.rgb[p * 3] * 255);
        bytes[o + 1] = Math.round(r.rgb[p * 3 + 1] * 255);
        bytes[o + 2] = Math.round(r.rgb[p * 3 + 2] * 255);
        bytes[o + 3] = r.mask[p] ? 255 : 0;
      }
    });
    ids.push(e.id);
    chunks.push(bytes);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

// Ordre stable (celui du wiki) pour des diffs lisibles.
const order = official.entries.map((e) => e.id);
const sorted = order.map((id) => chunks[ids.indexOf(id)]);
await writeFile(join(ROOT, 'data/portraits.bin'), Buffer.concat(sorted));
await writeFile(join(ROOT, 'data/portraits.json'), JSON.stringify({ side: SIDE, windows: WINDOWS.length, ids: order }) + '\n');
console.log(`data/portraits.bin : ${order.length} Aniimo × ${WINDOWS.length} cadrages`);
