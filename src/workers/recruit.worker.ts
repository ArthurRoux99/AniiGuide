import { rankRecruits, type RecruitInput } from '../engine/homeland/recruit';

// Calcul « Qui recruter ? » hors du fil principal : une centaine de plans, quelques secondes.
self.onmessage = (e: MessageEvent<RecruitInput>) => {
  let last = 0;
  const result = rankRecruits(e.data, (done, total) => {
    const now = Date.now();
    if (now - last > 150 || done === total) {
      last = now;
      self.postMessage({ type: 'progress', done, total });
    }
  });
  self.postMessage({ type: 'done', result });
};
