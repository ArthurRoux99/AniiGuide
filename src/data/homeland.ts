import raw from './homeland.gen.json';
import type { AbilityId } from '../engine/abilities';
import type { Letter } from '../engine/personality';

// Données de production du Logis (import Aniimax, licence MIT) + noms FR relevés en jeu.

export type RecipeKind = 'grower' | 'gatherer' | 'processor';
export type Environment = 'Warm' | 'Scorching' | 'Cool' | 'Freeze' | 'Adequate';

export interface Recipe {
  id: string;
  facility: string;
  kind: RecipeKind;
  level: number;
  output: { item: string; qty: number };
  inputs: { item: string; qty: number }[];
  byproduct?: { item: string; qty: number };
  module: { id: string; level: number } | null;
  environment: Environment | null;
  verified: boolean;
  /** Cultures : durée d'un cycle en secondes (minuterie fixe) et coût des graines. */
  seconds?: number;
  seedCost?: number;
  /** Cultures : tâches des Aniimo à chaque récolte (défricher, semer, récolter…). */
  steps?: { step: string; ability: AbilityId; level: number; workload: number }[];
  /** Installations travaillées : charge de travail et capacité requise. */
  workload?: number;
  ability?: AbilityId | null;
  abilityLevel?: number;
}

export interface Facility {
  id: string;
  name: string;
  category: string;
  hasLevels: boolean;
  ability: AbilityId | null;
  personality: Letter | null;
  /** niveau d'installation → niveau de Camping-car qui le débloque */
  unlocks: Record<string, number>;
  /** nombre d'exemplaires plaçables, index = niveau de Camping-car − 1 (la dernière valeur se prolonge) */
  counts: number[];
}

export interface Item {
  name: string;
  sellValue: number;
  currency: string;
}

interface HomelandData {
  source: { repo: string; sha: string; license: string };
  facilities: Facility[];
  recipes: Recipe[];
  items: Record<string, Item>;
  levelUp: Record<string, { coins: number; items: Record<string, number> }>;
  levelUpChains: string[][];
  moduleMaxLevels: Record<string, number[]>;
  specialRecipes: string[];
  names: { facilities: Record<string, string>; items: Record<string, string> };
  /** Par installation et par niveau (index 0 = niveau 1) : stock, puissance électrique, coût en Pièces de logis. */
  levels: Record<string, { stock: number | null; power: number | null; cost: number | null }[]>;
}

export const HOMELAND = raw as unknown as HomelandData;
export const FACILITY_BY_ID = new Map(HOMELAND.facilities.map((f) => [f.id, f]));
export const RECIPES = HOMELAND.recipes;

/** Nom FR si relevé en jeu, sinon nom anglais. */
export function facilityName(id: string): { name: string; fr: boolean } {
  const fr = HOMELAND.names.facilities[id];
  return fr ? { name: fr, fr: true } : { name: FACILITY_BY_ID.get(id)?.name ?? id, fr: false };
}

export function itemName(id: string): { name: string; fr: boolean } {
  const fr = HOMELAND.names.items[id];
  return fr ? { name: fr, fr: true } : { name: HOMELAND.items[id]?.name ?? id, fr: false };
}

/** Valeur d'une liste par niveau de Camping-car, la dernière valeur se prolongeant au-delà. */
export const atRv = (list: number[], rv: number) => list[Math.min(rv, list.length) - 1] ?? 0;
