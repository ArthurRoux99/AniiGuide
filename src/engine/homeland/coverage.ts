import raw from '../../data/climate-layouts.gen.json';

// Couverture des appareils climatiques (Radiateur, Refroidisseur, Lampe solaire).
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
