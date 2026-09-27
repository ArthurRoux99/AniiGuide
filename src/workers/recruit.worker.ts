import { initSolver } from '../engine/lp';
import { rankRecruits, type RecruitInput } from '../engine/homeland/recruit';

// Calcul « Qui recruter ? » hors du fil principal : une centaine de plans, quelques secondes.
// La page envoie l'adresse absolue du solveur (le worker, intégré en blob, ne peut pas la résoudre).
self.onmessage = async (e: MessageEvent<{ wasmUrl: string; input: RecruitInput }>) => {
  await initSolver(e.data.wasmUrl);
  let last = 0;
  const result = rankRecruits(e.data.input, (done, total) => {
    const now = Date.now();
    if (now - last > 150 || done === total) {
      last = now;
      self.postMessage({ type: 'progress', done, total });
    }
  });
  self.postMessage({ type: 'done', result });
};
