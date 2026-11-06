// Prismana mis en avant chaque semaine (annonce officielle de la mise à jour du 29 octobre 2026,
// aniimo.com). Les semaines commencent le lundi à 4 h, heure du serveur.
export interface PrismanaWeek {
  from: string;
  to: string;
  ids: string[];
}

export const PRISMANA_WEEKS: PrismanaWeek[] = [
  { from: '2026-11-02', to: '2026-11-09', ids: ['008-prismana-form'] },
  { from: '2026-11-09', to: '2026-11-16', ids: ['022-prismana-form'] },
  { from: '2026-11-16', to: '2026-11-23', ids: ['028-prismana-form'] },
  { from: '2026-11-23', to: '2026-11-30', ids: ['010-prismana-form'] },
  { from: '2026-11-30', to: '2026-12-07', ids: ['008-prismana-form', '022-prismana-form', '028-prismana-form', '010-prismana-form'] },
];

export const PRISMANA_SOURCE = 'https://aniimo.com';
