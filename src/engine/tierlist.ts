// Tier list de consensus : plusieurs tier lists publiées, ramenées sur une même échelle puis
// moyennées. Chaque source garde son propre barème (S+/S/A/B, SS/S/A/B, S…D) : on le convertit en
// note de 0 (dernier palier) à 1 (premier palier), puis on fait la moyenne des sources qui classent
// l'Aniimo.

export interface TierSource {
  id: string;
  source: string;
  url: string;
  note: string | null;
  pageDate: string | null;
  fetchedAt: string;
  scale: string[];
  entries: { id: string; tier: string }[];
}

export const CONSENSUS_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
export type ConsensusTier = (typeof CONSENSUS_TIERS)[number];

export interface ConsensusEntry {
  id: string;
  score: number;
  tier: ConsensusTier;
  /** Note et palier donnés par chaque source qui le classe. */
  votes: { source: string; tier: string; score: number }[];
  /** Écart entre la meilleure et la moins bonne note (0 = tout le monde d'accord). */
  spread: number;
}

/** Palier de consensus d'une note moyenne (seuils réguliers). */
export function tierOf(score: number): ConsensusTier {
  if (score >= 0.8) return 'S';
  if (score >= 0.6) return 'A';
  if (score >= 0.4) return 'B';
  if (score >= 0.2) return 'C';
  return 'D';
}

export function sourceScore(scale: string[], tier: string): number | null {
  const i = scale.indexOf(tier);
  if (i < 0) return null;
  return scale.length === 1 ? 1 : 1 - i / (scale.length - 1);
}

export function consensus(sources: TierSource[], minVotes = 1): ConsensusEntry[] {
  const votes = new Map<string, ConsensusEntry['votes']>();
  for (const s of sources) {
    for (const e of s.entries) {
      const score = sourceScore(s.scale, e.tier);
      if (score == null) continue;
      if (!votes.has(e.id)) votes.set(e.id, []);
      votes.get(e.id)!.push({ source: s.id, tier: e.tier, score });
    }
  }
  return [...votes.entries()]
    .filter(([, v]) => v.length >= minVotes)
    .map(([id, v]) => {
      const score = v.reduce((a, b) => a + b.score, 0) / v.length;
      const scores = v.map((x) => x.score);
      return { id, score, tier: tierOf(score), votes: v, spread: Math.max(...scores) - Math.min(...scores) };
    })
    .sort((a, b) => b.score - a.score || b.votes.length - a.votes.length);
}
