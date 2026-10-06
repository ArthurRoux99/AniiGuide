import { sanitizeProfile, type Profile } from './profile';

// Partage du profil par lien (et QR code) : le profil est compressé puis encodé dans l'adresse,
// après « #import= ». Rien ne passe par un serveur : le lien contient tout.

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Le strict nécessaire : les dates et l'ordre des clés ne voyagent pas. */
function compact(p: Profile) {
  return {
    v: 1,
    rv: p.rv,
    c: p.coins,
    s: p.shinies,
    st: p.stock,
    w: p.workers.map((w) => (w.personality ? [w.aniimoId, w.personality] : [w.aniimoId])),
    col: p.collection,
    u: p.usedCodes,
    eh: p.eggHeist,
    f: p.facilities,
  };
}

export async function encodeProfile(p: Profile): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(compact(p)));
  if (typeof CompressionStream === 'undefined') return 'j' + b64url(raw);
  return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
}

export async function decodeProfile(code: string): Promise<Profile> {
  const bytes = unb64url(code.slice(1));
  const raw = code[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const c = JSON.parse(new TextDecoder().decode(raw));
  return sanitizeProfile({
    version: 1,
    rv: c.rv,
    coins: c.c,
    shinies: c.s,
    stock: c.st,
    workers: (c.w ?? []).map(([aniimoId, personality]: [string, string?]) => ({ aniimoId, personality: personality ?? null })),
    collection: c.col,
    usedCodes: c.u,
    eggHeist: c.eh,
    facilities: c.f,
  });
}

export const shareUrl = (code: string) => `${location.origin}${location.pathname}#import=${code}`;
