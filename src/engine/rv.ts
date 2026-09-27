// Camping-car (RV) : niveaux 1 → 20.

export type Confidence = 'officiel' | 'communaute' | 'a-verifier';

/** Nombre max d'Aniimo au logis par niveau de Camping-car (index = niveau). */
export const MAX_ANIIMO_BY_RV = [0, 5, 8, 11, 14, 17, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 43, 44, 45];

/** Niveaux dont la valeur a été vue en jeu. */
export const MAX_ANIIMO_VERIFIED = new Set([8, 9]);

export function maxAniimo(rv: number): { value: number; confidence: Confidence } {
  const level = Math.min(20, Math.max(1, Math.round(rv)));
  return {
    value: MAX_ANIIMO_BY_RV[level],
    confidence: MAX_ANIIMO_VERIFIED.has(level) ? 'officiel' : 'communaute',
  };
}
