// Personnalités : 4 lettres, une par paire opposée (I/E, N/S, F/T, P/J).
// Chaque lettre donne +20 % d'efficacité dans certaines installations (données communautaires,
// T confirmé en jeu sur le Moulin-carrousel). Les noms d'installation sans nom FR relevé
// restent en anglais en attendant.

export const PERSONALITY_PAIRS = [
  ['I', 'E'],
  ['N', 'S'],
  ['F', 'T'],
  ['P', 'J'],
] as const;

export type Letter = 'I' | 'E' | 'N' | 'S' | 'F' | 'T' | 'P' | 'J';

export const PERSONALITY_BONUS: Record<Letter, { name: string; facilities: string[] }> = {
  E: { name: 'Énergique', facilities: ['Bouncy Brew Keg', 'Woodworking Bench'] },
  I: { name: 'Instinctive', facilities: ['Phonolfactory Table', 'Dewy House'] },
  S: { name: 'Pratique', facilities: ['Claw Game Cooker', 'Chimney Kiln'] },
  N: { name: 'Vive', facilities: ['Jukebox Dryer', 'Blazing Stove', 'Floral Windmill'] },
  T: { name: 'Tenace', facilities: ['Moulin-carrousel', 'Simmering Pot'] },
  F: { name: 'Fidèle', facilities: ['Joy Wheel Loom', 'Puits', 'Starfall Hammock'] },
  J: { name: 'Judicieuse', facilities: ['Crafting Table', 'Tidewhisper Sandcastle', 'Nimbus Bed'] },
  P: { name: 'Joueuse', facilities: ['Mine', 'Pickling Jar'] },
};

/** Normalise une saisie (« entp », « E N T P »…) ; renvoie null si elle n'est pas valide. */
export function parsePersonality(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length !== 4) return null;
  return PERSONALITY_PAIRS.every(([a, b], i) => s[i] === a || s[i] === b) ? s : null;
}
