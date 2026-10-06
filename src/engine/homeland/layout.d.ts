// Types du placement repris d'Aniimax (layout.js). Tout est en cases.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Member extends Rect {
  /** Allers-retours par heure vers l'Entrepôt (lots terminés à rapporter). */
  weight: number;
  /** Culture climatique cultivée hors zone : ne doit toucher aucune zone. */
  sensitive?: boolean;
  [extra: string]: unknown;
}

export interface RigidPiece {
  members: Member[];
  [extra: string]: unknown;
}

export interface ClusterPiece {
  cluster: true;
  buildings: Rect[];
  plots: (Member & { zone: number })[];
  /** Position de chaque parcelle dans le placement prévu, relative à l'appareil. */
  planned: { x: number; y: number }[];
  [extra: string]: unknown;
}

export type Piece = RigidPiece | ClusterPiece;

export interface LayoutResult {
  storage: Rect;
  storageAt: { x: number; y: number };
  unplaced: number[];
  tried: number;
  pieces: (Piece & { members: Member[]; cost: number })[];
}

export function layOutHomeland(pieces: Piece[], cells: Rect[], storage?: { w: number; h: number }): LayoutResult;
