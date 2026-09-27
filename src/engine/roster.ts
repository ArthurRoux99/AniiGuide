import { ABILITIES, abilityDistribution, bestLevels, type AbilityId, type AbilityLevels } from './abilities';

export interface Candidate {
  id: string;
  homeland: AbilityLevels;
  prismana: boolean;
}

export interface Gap {
  ability: AbilityId;
  count: number;
  best: number;
  /** Aniimo qui amélioreraient ce point, du plus utile au moins utile. */
  suggestions: Candidate[];
}

/**
 * Repère les capacités absentes ou de faible niveau dans l'équipe, et propose des Aniimo pour les
 * combler, en commençant par les formes non prismana (bien plus faciles à obtenir). Le niveau 3
 * est la cible : c'est le maximum hors formes prismana, et la plupart des recettes avancées le
 * demandent.
 */
export function findGaps(workers: readonly AbilityLevels[], pool: readonly Candidate[], target = 3, perGap = 4): Gap[] {
  const counts = abilityDistribution(workers);
  const best = bestLevels(workers);
  return ABILITIES.filter((a) => best[a.id] < target)
    .map((a) => ({
      ability: a.id,
      count: counts[a.id],
      best: best[a.id],
      suggestions: pool
        .filter((c) => (c.homeland[a.id] ?? 0) > best[a.id])
        .sort(
          (x, y) =>
            Number(x.prismana) - Number(y.prismana) ||
            (y.homeland[a.id] ?? 0) - (x.homeland[a.id] ?? 0) ||
            Object.keys(y.homeland).length - Object.keys(x.homeland).length,
        )
        .slice(0, perGap),
    }))
    .sort((x, y) => x.best - y.best || x.count - y.count);
}
