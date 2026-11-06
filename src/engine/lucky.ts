// Lancers Lucky / Super Lucky et énergie prismatique (chances de l'annonce officielle du jeu,
// recoupées par aniidex.com et aniimoguide.com, mêmes chiffres).
//
// Chaque capture réussie tire d'abord un Super Lucky, puis un Lucky s'il ne sort pas. La chance de
// base baisse avec le nombre obtenu dans la semaine (compté à part pour chaque type), et une garantie
// le donne au plus tard à la N-ième capture depuis le dernier. Remise à zéro le lundi à 4 h, heure
// du serveur.

export type Server = 'eu' | 'apac' | 'am';
/** Décalage horaire de chaque serveur (heures). */
export const SERVER_OFFSET: Record<Server, number> = { eu: 0, apac: 8, am: -4 };
export const SERVER_NAME: Record<Server, string> = { eu: 'Europe (UTC+0)', apac: 'Asie-Pacifique (UTC+8)', am: 'Amériques (UTC−4)' };

export interface Tier {
  /** Chance par capture réussie. */
  p: number;
  /** Garanti au plus tard à cette capture depuis le dernier. */
  cap: number;
}

/** Lucky : 1 % (garanti à 200) pour les 10 premiers de la semaine, puis 0,5 % (garanti à 400). */
export const luckyTier = (thisWeek: number): Tier => (thisWeek < 10 ? { p: 0.01, cap: 200 } : { p: 0.005, cap: 400 });
/** Super Lucky : 0,2 % (500) pour le 1er de la semaine, 0,1 % (1 000) le 2e, puis 0,05 % (3 000). */
export const superTier = (thisWeek: number): Tier =>
  thisWeek < 1 ? { p: 0.002, cap: 500 } : thisWeek < 2 ? { p: 0.001, cap: 1000 } : { p: 0.0005, cap: 3000 };

/** Chance d'en obtenir au moins un dans les `n` prochaines captures, `since` captures après le dernier. */
export function chanceWithin(tier: Tier, since: number, n: number): number {
  if (since + n >= tier.cap) return 1;
  return 1 - (1 - tier.p) ** n;
}

/** Captures restantes avant la garantie. */
export const untilGuaranteed = (tier: Tier, since: number) => Math.max(0, tier.cap - since);

/** Début de la semaine en cours (lundi 4 h, heure du serveur), en millisecondes. */
export function weekStart(now: number, server: Server): number {
  const shift = SERVER_OFFSET[server] * 3600e3;
  const local = new Date(now + shift);
  // Jours écoulés depuis lundi, en heure du serveur.
  const day = (local.getUTCDay() + 6) % 7;
  let start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day, 4) - shift;
  if (start > now) start -= 7 * 86400e3;
  return start;
}

// Énergie prismatique d'une zone : pleine à 10 500, un Prismana y apparaît alors à coup sûr.
export const ENERGY_FULL = 10500;
/** Lucky : 275 (40 %), 300 (50 %), 350 (5 %), 500 (5 %), soit 302,5 en moyenne. */
export const ENERGY_LUCKY = 302.5;
export const ENERGY_SUPER = 1500;
/** Nourrir la Branche (Essence de veine) ; +50 % pendant l'Abondance de la Veine. */
export const ENERGY_NURTURE = 480;
/** Paliers affichés en jeu. */
export const ENERGY_STATES: [number, string][] = [
  [0, 'Vide'],
  [501, 'Très faible'],
  [1501, 'Faible'],
  [3001, 'Abondante'],
  [6001, 'Très élevée'],
  [10500, 'Pleine'],
];

export const energyState = (energy: number) => [...ENERGY_STATES].reverse().find(([min]) => energy >= min)![1];

/** Ce qu'il manque pour remplir la jauge : en Lucky (moyenne), en Super Lucky ou en Nourrissages. */
export function toFull(energy: number, abundance = false) {
  const left = Math.max(0, ENERGY_FULL - energy);
  return {
    left,
    lucky: Math.ceil(left / ENERGY_LUCKY),
    superLucky: Math.ceil(left / ENERGY_SUPER),
    nurture: Math.ceil(left / (ENERGY_NURTURE * (abundance ? 1.5 : 1))),
  };
}
