import { useCallback, useEffect, useState } from 'react';
import { ANIIMO_BY_ID } from '../data/aniimo';
import { parsePersonality } from '../engine/personality';
import example from '../data/exemple-rv8.gen.json';

// Profil « Mon Logis », sauvegardé dans le navigateur. Tout est local : rien n'est envoyé.

export interface Worker {
  uid: string;
  aniimoId: string;
  /** 4 lettres (ex. « ENTP »), propres à chaque individu. */
  personality: string | null;
}

export interface Profile {
  version: 1;
  rv: number;
  coins: number | null;
  workers: Worker[];
  /** Aniimo éclatants placés en zone de construction (produisent des Tickets bourgeon). */
  shinies: number;
  /** Matériaux du prochain niveau de Camping-car déjà en stock (identifiant d'objet → quantité). */
  stock: Record<string, number>;
  /** Aniimo possédés pour le combat (hors ouvriers du logis). */
  collection: string[];
  /** Codes cadeaux déjà utilisés (en minuscules). */
  usedCodes: string[];
  /** Opération Œufs : pièces de coquille, éclats prismana, rang. */
  eggHeist: { coins: number; shards: number; rank: number };
  updatedAt: string;
}

const KEY = 'aniiguide.profile.v1';

export const emptyProfile = (): Profile => ({ version: 1, rv: 1, coins: null, workers: [], shinies: 0, stock: {}, collection: [], usedCodes: [], eggHeist: { coins: 0, shards: 0, rank: 0 }, updatedAt: new Date().toISOString() });

const uid = () => Math.random().toString(36).slice(2, 10);

export function exampleProfile(): Profile {
  return {
    version: 1,
    rv: example.rv,
    coins: example.pieces,
    shinies: example.eclatants,
    stock: { ...example.stock },
    collection: [],
    usedCodes: [],
    eggHeist: { coins: 0, shards: 0, rank: 0 },
    workers: example.ouvriers.map((o) => ({ uid: uid(), aniimoId: o.aniimo, personality: o.personnalite })),
    updatedAt: new Date().toISOString(),
  };
}

/** Valide un profil importé (fichier) et écarte ce qui est inconnu. */
export function sanitizeProfile(input: unknown): Profile {
  const p = (input ?? {}) as Partial<Profile>;
  if (p.version !== 1 || !Array.isArray(p.workers)) throw new Error('Fichier de profil AniiGuide invalide.');
  return {
    version: 1,
    rv: Math.min(20, Math.max(1, Number(p.rv) || 1)),
    coins: p.coins == null ? null : Number(p.coins) || 0,
    shinies: Math.max(0, Number(p.shinies) || 0),
    stock: Object.fromEntries(Object.entries(p.stock ?? {}).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])),
    collection: Array.isArray(p.collection) ? [...new Set(p.collection.map(String).filter((id) => ANIIMO_BY_ID.has(id)))] : [],
    eggHeist: {
      coins: Math.max(0, Number(p.eggHeist?.coins) || 0),
      shards: Math.max(0, Number(p.eggHeist?.shards) || 0),
      rank: Math.min(6, Math.max(0, Number(p.eggHeist?.rank) || 0)),
    },
    usedCodes: Array.isArray(p.usedCodes) ? [...new Set(p.usedCodes.map((c) => String(c).toLowerCase()))] : [],
    workers: p.workers
      .filter((w) => w && ANIIMO_BY_ID.has(String(w.aniimoId)))
      .map((w) => ({ uid: String(w.uid || uid()), aniimoId: String(w.aniimoId), personality: w.personality ? parsePersonality(String(w.personality)) : null })),
    updatedAt: new Date().toISOString(),
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      // Stockage indisponible (navigation privée) : le profil reste en mémoire le temps de la visite.
    }
  }, [profile]);

  const update = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => ({ ...fn(p), updatedAt: new Date().toISOString() })), []);

  return {
    profile,
    replace: (p: Profile) => setProfile(p),
    setRv: (rv: number) => update((p) => ({ ...p, rv: Math.min(20, Math.max(1, rv)) })),
    setCoins: (n: number) => update((p) => ({ ...p, coins: Math.max(0, n) })),
    setStock: (item: string, n: number) => update((p) => ({ ...p, stock: { ...p.stock, [item]: Math.max(0, n) } })),
    addToCollection: (id: string) => update((p) => ({ ...p, collection: p.collection.includes(id) ? p.collection : [...p.collection, id] })),
    removeFromCollection: (id: string) => update((p) => ({ ...p, collection: p.collection.filter((x) => x !== id) })),
    toggleCode: (code: string) =>
      update((p) => {
        const c = code.toLowerCase();
        return { ...p, usedCodes: p.usedCodes.includes(c) ? p.usedCodes.filter((x) => x !== c) : [...p.usedCodes, c] };
      }),
    setEggHeist: (patch: Partial<Profile['eggHeist']>) => update((p) => ({ ...p, eggHeist: { ...p.eggHeist, ...patch } })),
    setShinies: (n: number) => update((p) => ({ ...p, shinies: Math.max(0, n) })),
    addWorker: (aniimoId: string) => update((p) => ({ ...p, workers: [...p.workers, { uid: uid(), aniimoId, personality: null }] })),
    removeWorker: (id: string) => update((p) => ({ ...p, workers: p.workers.filter((w) => w.uid !== id) })),
    setPersonality: (id: string, personality: string | null) =>
      update((p) => ({ ...p, workers: p.workers.map((w) => (w.uid === id ? { ...w, personality } : w)) })),
  };
}

export type ProfileApi = ReturnType<typeof useProfile>;
