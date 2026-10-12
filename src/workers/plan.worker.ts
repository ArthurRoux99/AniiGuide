import { initSolver } from '../engine/lp';
import { plan, type PlanOptions } from '../engine/homeland/optimize';

// Calcul exact du plan (machines dédiées, parcelles entières, paires d'appareils : jusqu'à une
// seconde ou plus sur téléphone) hors du fil principal, pour que la page reste fluide.
self.onmessage = async (e: MessageEvent<{ id: number; wasmUrl: string; options: PlanOptions }>) => {
  await initSolver(e.data.wasmUrl);
  self.postMessage({ id: e.data.id, result: plan({ ...e.data.options, exact: true, pairs: true }) });
};
