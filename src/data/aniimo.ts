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
