import raw from './aniimo.gen.json';
import type { AbilityId, AbilityLevels } from '../engine/abilities';

export interface Aniimo {
  id: string;
  number: string;
  /** Nom FR de la forme, null pour la forme de base. */
  form: string | null;
  prismana: boolean;
  stage: number | null;
  name: string;
  nameEn: string;
  image: string;
  head: string | null;
  elements: string[];
  roles: string[];
  /** Total des stats de combat (fiche officielle). */
  statTotal: number | null;
  homeland: AbilityLevels;
  habitats: string[];
}

export const ANIIMO: readonly Aniimo[] = raw.aniimo as Aniimo[];
export const ANIIMO_BY_ID: ReadonlyMap<string, Aniimo> = new Map(ANIIMO.map((a) => [a.id, a]));

/** Formes renommées sur le wiki officiel (29/10/2026) : ancien suffixe d'identifiant → nouveau. */
const RENAMED_FORMS: Record<string, string> = {
  'mountain-woods-form': 'timberline-form',
  'sea-of-flowers-form': 'flowerfield-form',
  'rainstorm-form': 'rainfall-form',
};

/** Identifiant actuel d'une fiche (les profils enregistrés avant un renommage gardent l'ancien). */
export function currentId(id: string): string {
  for (const [from, to] of Object.entries(RENAMED_FORMS)) if (id.endsWith(`-${from}`)) return id.slice(0, -from.length) + to;
  return id;
}
export const OFFICIAL_FETCHED_AT: string = raw.fetchedAt;

export const fullName = (a: Aniimo) => (a.form ? `${a.name} (${a.form.replace(/^Forme (de la |des |de |du )?/, '')})` : a.name);

/** Recherche insensible aux accents, sur le nom FR, le nom anglais et la forme. */
export function matches(a: Aniimo, query: string): boolean {
  if (!query) return true;
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const q = norm(query.trim());
  return [a.name, a.nameEn, a.form ?? ''].some((s) => norm(s).includes(q));
}

export const levelOf = (a: Aniimo, ability: AbilityId) => a.homeland[ability] ?? 0;
