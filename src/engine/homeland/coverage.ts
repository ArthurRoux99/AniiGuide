import raw from '../../data/climate-layouts.gen.json';
import rawPairs from '../../data/pair-layouts.gen.json';

// Couverture des appareils climatiques (Fournaise thermique, Climatisation, Lampe d'incubation).
//
// Règles (Aniimax, MIT, src/coverage.rs, confirmées sur une capture du jeu) : l'appareil couvre un
// carré de 9×9 cases centré sur lui, et une parcelle compte dès qu'elle chevauche ce carré. Les
// placements optimaux (au quart de case près) sont précalculés par scripts/build-climate-layouts.mjs :
// pour chaque taille d'appareil, les mélanges non dominés de Fermes (2×2), Pépinières (4×4) et
// grandes installations 5×5, avec la position de chaque parcelle.

export type PlotKind = 'farmland' | 'woodland' | 'big';

export interface Layout {
  farmland: number;
  woodland: number;
  big: number;
  /** Coin de chaque parcelle, en cases, relatif au coin de l'appareil. */
  plots: { kind: PlotKind; x: number; y: number }[];
}

interface Data {
  radius: number;
  sizes: Record<PlotKind, number>;
  devices: Record<string, number>;
  layouts: Record<string, Layout[]>;
}
export const COVERAGE = raw as unknown as Data;

/** Installations dont les recettes climatiques se couvrent, et leur type de parcelle. */
export const PLOT_KIND: Record<string, PlotKind> = {
  farmland: 'farmland',
  woodland: 'woodland',
  'tidewhisper-sandcastle': 'big',
  'starfall-hammock': 'big',
  'floral-windmill': 'big',
};

export const deviceSize = (device: string) => COVERAGE.devices[device] ?? 2;

/** Mélanges possibles autour d'un appareil. */
export const layoutsFor = (device: string): Layout[] => COVERAGE.layouts[String(deviceSize(device))] ?? [];

/** Plus grand nombre de parcelles d'un type seul autour d'un appareil. */
export const maxPlots = (device: string, kind: PlotKind) => Math.max(0, ...layoutsFor(device).map((l) => l[kind]));

/**
 * Paire Fournaise thermique (1×1, en [0,1]²) + Climatisation (2×2, à l'écart dx, dy) dont les zones
 * se chevauchent : trois zones, Fournaise seule (0), les deux (1, températures additionnées),
 * Climatisation seule (2). Placements précalculés par scripts/build-pair-layouts.mjs.
 */
export interface PairLayout {
  dx: number;
  dy: number;
  /** Parcelles par zone (0, 1, 2) et par type (dans l'ordre de PAIR_KINDS). */
  counts: number[][];
  plots: { kind: PlotKind; x: number; y: number; zone: number }[];
}
export const PAIR_KINDS = (rawPairs as { kinds: PlotKind[] }).kinds;
export const PAIR_LAYOUTS = (rawPairs as unknown as { layouts: PairLayout[] }).layouts;

/** Réglages utiles d'une paire : ceux dont la zone commune donne un troisième climat. */
export const PAIR_COMBOS: { heat: 'Warm' | 'Scorching'; cool: 'Cool' | 'Freeze'; both: 'Cool' | 'Warm' }[] = [
  { heat: 'Warm', cool: 'Freeze', both: 'Cool' }, // +1 − 2 = −1
  { heat: 'Scorching', cool: 'Cool', both: 'Warm' }, // +2 − 1 = +1
];
