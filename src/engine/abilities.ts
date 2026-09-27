// Capacités de logis : les 13 compétences de travail des Aniimo.
// Ordre, couleurs et correspondance avec les codes du wiki officiel (home-1000…1103)
// vérifiés sur l'écran « Distribution des capacités » du jeu.

export type AbilityId =
  | 'fire'
  | 'grass'
  | 'water'
  | 'earth'
  | 'lightning'
  | 'ice'
  | 'wind'
  | 'dark'
  | 'light'
  | 'hauling'
  | 'artisanship'
  | 'leisure'
  | 'perfumery';

export interface Ability {
  id: AbilityId;
  name: string;
  icon: string;
  color: string;
  role: string;
}

export const ABILITIES: readonly Ability[] = [
  { id: 'fire', name: 'Feu', icon: '🔥', color: '#e26161', role: 'Cuisine, fonte, chaleur' },
  { id: 'grass', name: 'Plante', icon: '🌿', color: '#51b17a', role: 'Semer, cueillir' },
  { id: 'water', name: 'Eau', icon: '💧', color: '#529de7', role: 'Brasser, puiser, arroser' },
  { id: 'earth', name: 'Terre', icon: '⛰️', color: '#bea77b', role: 'Défricher, miner' },
  { id: 'lightning', name: 'Foudre', icon: '⚡', color: '#e0c21a', role: 'Électricité, Aniipods' },
  { id: 'ice', name: 'Glace', icon: '❄️', color: '#45c1d6', role: 'Refroidir' },
  { id: 'wind', name: 'Vent', icon: '🌀', color: '#3fb8a5', role: 'Moudre, transformer par le vent' },
  { id: 'dark', name: 'Ténèbres', icon: '🌑', color: '#a373d2', role: 'Récolter, couper, saumurer, sécher' },
  { id: 'light', name: 'Lumière', icon: '☀️', color: '#f6a93c', role: 'Éclairer' },
  { id: 'hauling', name: 'Transport', icon: '🛒', color: '#6285cc', role: "Porter la production à l'entrepôt" },
  { id: 'artisanship', name: 'Artisanat', icon: '✂️', color: '#71b258', role: 'Objets artisanaux' },
  { id: 'leisure', name: 'Loisir', icon: '🎡', color: '#e77894', role: 'Produire en jouant' },
  { id: 'perfumery', name: 'Parfumerie', icon: '🧴', color: '#b579dc', role: 'Table à parfums' },
];

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a])) as Record<AbilityId, Ability>;

export type AbilityLevels = Partial<Record<AbilityId, number>>;

/** Compte, pour chaque capacité, combien d'Aniimo la possèdent (comme l'écran du jeu). */
export function abilityDistribution(workers: readonly AbilityLevels[]): Record<AbilityId, number> {
  const out = Object.fromEntries(ABILITIES.map((a) => [a.id, 0])) as Record<AbilityId, number>;
  for (const w of workers) for (const id of Object.keys(w) as AbilityId[]) out[id] += 1;
  return out;
}

/** Meilleur niveau disponible pour chaque capacité. */
export function bestLevels(workers: readonly AbilityLevels[]): Record<AbilityId, number> {
  const out = Object.fromEntries(ABILITIES.map((a) => [a.id, 0])) as Record<AbilityId, number>;
  for (const w of workers) for (const [id, lvl] of Object.entries(w) as [AbilityId, number][]) out[id] = Math.max(out[id], lvl);
  return out;
}
