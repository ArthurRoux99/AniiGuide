import { homelandPlan } from '../engine/homeland/homeland-plan';
import type { ClimateLayout } from '../engine/homeland/climate';
import type { PlanRow } from '../engine/homeland/optimize';

// Plan complet du logis hors du fil principal (une à quelques secondes sur téléphone).
self.onmessage = (e: MessageEvent<{ rows: PlanRow[]; whole: number[]; climate: ClimateLayout; rv: number }>) => {
  const { rows, whole, climate, rv } = e.data;
  const map = new Map(rows.map((r, i) => [r, whole[i]]));
  self.postMessage(homelandPlan(rows, map, climate, rv));
};
