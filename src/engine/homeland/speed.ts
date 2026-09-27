// Vitesse de travail des Aniimo au Logis.
// Formules reprises d'Aniimax (licence MIT, https://github.com/ae-bii/aniimax, src/models.rs),
// où chacune est relevée en jeu ; les exemples cités dans les commentaires viennent de là.

/** Charge de travail traitée par seconde à 100 % sur une collecte : 1 au niveau 1, +0,25 par niveau. */
export function baseWorkRate(required: number): number {
  return 1 + 0.25 * (Math.max(1, required) - 1);
}

/**
 * Efficacité affichée par le jeu (1 = 100 %) pour un Aniimo de niveau `level` sur une recette qui
 * demande `required`.
 * - Transformation : 100 % au niveau requis, puis 300 %, 400 %, 500 %.
 * - Collecte (Mine, Puits…) : +0,5 charge/s par niveau au-dessus, soit +50 % sur une recette niv. 1,
 *   +40 % niv. 2, +33 % niv. 3.
 */
export function efficiency(level: number, required: number, gathering: boolean): number {
  const req = Math.max(1, required);
  const above = Math.max(level, req) - req;
  if (gathering) return 1 + (0.5 * above) / baseWorkRate(req);
  return above === 0 ? 1 : 2 + above;
}

/** Installations sans bonus de personnalité : +40 % par niveau au-dessus du requis. */
export const NO_PERSONALITY_FACILITIES = new Set(['dance-pad-polisher', 'aniipod-maker']);

export const PERSONALITY_BONUS = 1.2;

/** Durée (s) d'un lot sur une installation travaillée. */
export function workSeconds(opts: {
  facility: string;
  workload: number;
  required: number;
  level: number;
  personality: boolean;
  gathering: boolean;
}): number {
  const { facility, workload, required, level, personality, gathering } = opts;
  if (NO_PERSONALITY_FACILITIES.has(facility)) {
    const eff = 1 + 0.4 * (Math.min(4, Math.max(level, required)) - required);
    return workload / (eff * baseWorkRate(required));
  }
  const speed = efficiency(level, required, gathering) * (personality ? PERSONALITY_BONUS : 1);
  return workload / (speed * (gathering ? baseWorkRate(required) : 1));
}

/** Arrosage : 2 arrosages par pousse, chacun retire 1/8 du temps de pousse (40 min → 30 min). */
export function wateredSeconds(seconds: number, atFullSpeed = seconds): number {
  return Math.max(0, seconds - 2 * 0.125 * atFullSpeed);
}

/**
 * Vitesse de pousse d'une culture climatique sans bâtiment au-dessus : l'échelle va de Gel (−2) à
 * Brûlant (+2) ; 80 % à un cran, 50 % à deux. « Adéquate » (Lampe solaire) ne pousse pas ailleurs.
 */
export function uncoveredFactor(env: string): number | null {
  if (env === 'Cool' || env === 'Warm') return 0.8;
  if (env === 'Freeze' || env === 'Scorching') return 0.5;
  return null;
}
