// Opération Œufs : combien de parties pour s'offrir un objet de la boutique.
//
// Espérance d'une partie : on gagne `coins` pièces de coquille et `shards` éclats si l'évacuation
// réussit (probabilité `success`) ; en cas d'échec on perd le sac et l'équipement porté
// (`lossOnFail`, en pièces, sauf protection du débutant).

export interface HeistInput {
  /** Prix visé. */
  price: { coins: number; shards: number };
  /** Ce que le joueur a déjà. */
  have: { coins: number; shards: number };
  /** Gains moyens d'une partie réussie. */
  perRun: { coins: number; shards: number };
  /** Part des parties réussies (0..1). */
  success: number;
  /** Valeur de l'équipement perdu en cas d'échec (pièces). */
  lossOnFail: number;
  /** Durée moyenne d'une partie (minutes). */
  minutes: number;
}

export interface HeistResult {
  /** Gain moyen net par partie. */
  netCoins: number;
  netShards: number;
  /** Parties nécessaires (null : jamais, la partie moyenne fait perdre). */
  runs: number | null;
  /** Ce qui limite : les pièces ou les éclats. */
  limit: 'coins' | 'shards' | 'none';
  hours: number | null;
}

export function heistPlan(i: HeistInput): HeistResult {
  const netCoins = i.success * i.perRun.coins - (1 - i.success) * i.lossOnFail;
  const netShards = i.success * i.perRun.shards;
  const needCoins = Math.max(0, i.price.coins - i.have.coins);
  const needShards = Math.max(0, i.price.shards - i.have.shards);
  const byCoins = needCoins === 0 ? 0 : netCoins > 0 ? Math.ceil(needCoins / netCoins) : Infinity;
  const byShards = needShards === 0 ? 0 : netShards > 0 ? Math.ceil(needShards / netShards) : Infinity;
  const runs = Math.max(byCoins, byShards);
  const limit = runs === 0 ? 'none' : byCoins >= byShards ? 'coins' : 'shards';
  return { netCoins, netShards, runs: isFinite(runs) ? runs : null, limit, hours: isFinite(runs) ? (runs * i.minutes) / 60 : null };
}
