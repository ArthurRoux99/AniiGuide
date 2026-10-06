// Combat : table des éléments et constructeur d'équipes de 4 Aniimo.
//
// Table des éléments (AniimoTools, recoupée avec GameRant) : ×1,6 sur une faiblesse, ×0,625 sur
// une résistance, ×1 sinon ; pour un Aniimo à deux éléments, les deux valeurs se multiplient
// (double faiblesse ×2,56, faiblesse + résistance ×1).

export type Element = 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'rock' | 'wind' | 'holy' | 'dark';

export const CHART: Record<Element, { strong: Element[]; weak: Element[] }> = {
  fire: { strong: ['grass', 'ice'], weak: ['fire', 'water', 'rock', 'holy'] },
  water: { strong: ['fire', 'rock'], weak: ['water', 'grass', 'ice', 'holy'] },
  grass: { strong: ['water', 'rock'], weak: ['fire', 'grass', 'holy'] },
  electric: { strong: ['water', 'wind'], weak: ['electric', 'ice', 'rock'] },
  ice: { strong: ['water', 'electric'], weak: ['fire', 'ice', 'rock'] },
  rock: { strong: ['fire', 'ice'], weak: ['water', 'grass', 'rock', 'dark'] },
  wind: { strong: ['grass', 'dark'], weak: ['electric', 'wind'] },
  holy: { strong: ['wind', 'dark'], weak: ['electric', 'holy'] },
  dark: { strong: ['grass', 'electric', 'holy'], weak: ['water', 'wind'] },
};

export const ELEMENT_IDS = Object.keys(CHART) as Element[];

/** Multiplicateur d'une attaque de l'élément `attack` sur un Aniimo des éléments `defender`. */
export function effectiveness(attack: string, defender: readonly string[]): number {
  const row = CHART[attack as Element];
  if (!row) return 1;
  return defender.reduce((m, d) => m * (row.strong.includes(d as Element) ? 1.6 : row.weak.includes(d as Element) ? 0.625 : 1), 1);
}

/** Meilleur multiplicateur qu'un Aniimo peut infliger à `defender` avec l'un de ses éléments. */
export const bestOffense = (attacker: readonly string[], defender: readonly string[]) =>
  Math.max(...attacker.map((a) => effectiveness(a, defender)), 1e-9);

export type Role = 'dps' | 'break' | 'sup' | 'heal' | 'energy';

export interface Fighter {
  id: string;
  species: string;
  elements: string[];
  roles: string[];
  /** Note de consensus de 0 à 1 (tier list). */
  score: number;
}

export interface TeamOptions {
  /** Élément(s) de l'ennemi visé : l'attaquant doit le frapper sur sa faiblesse. */
  enemy?: string[];
  /** Aniimo à inclure d'office. */
  locked?: string[];
  size?: number;
  /** Bonus par élément différent dans l'équipe (Opération Œufs : piliers élémentaires). */
  diversity?: number;
}

export interface Team {
  members: Fighter[];
  total: number;
  /** Rôles couverts et manquants. */
  missing: Role[];
  /** Éléments qui frappent au moins deux membres sur une faiblesse. */
  threats: string[];
  notes: string[];
}

/** Les rôles qu'une bonne équipe couvre : un attaquant, de la rupture, du soutien ou du soin, de l'énergie. */
const SLOTS: Role[][] = [['dps'], ['break'], ['sup', 'heal'], ['energy']];

function evaluate(members: Fighter[], o: TeamOptions): Team {
  const notes: string[] = [];
  let total = 0;
  for (const m of members) {
    let s = m.score;
    if (o.enemy?.length) {
      const off = bestOffense(m.elements, o.enemy);
      const def = Math.max(...o.enemy.map((e) => effectiveness(e, m.elements)));
      // L'attaquant compte surtout sur la faiblesse ennemie ; tout le monde encaisse.
      s *= m.roles.includes('dps') ? off : Math.sqrt(off);
      s /= Math.sqrt(def);
    }
    total += s;
  }
  const missing = SLOTS.filter((slot) => !members.some((m) => slot.some((r) => m.roles.includes(r)))).map((slot) => slot[0]);
  total -= 0.6 * missing.length;
  const dps = members.filter((m) => m.roles.includes('dps')).length;
  if (dps === 0) notes.push("Pas d'attaquant principal.");
  if (dps > 2) total -= 0.2 * (dps - 2);

  if (o.diversity) total += o.diversity * new Set(members.flatMap((m) => m.elements)).size;

  const threats = ELEMENT_IDS.filter((e) => members.filter((m) => effectiveness(e, m.elements) > 1.01).length >= 2);
  total -= 0.05 * threats.length;
  return { members, total, missing, threats, notes };
}

/**
 * Meilleures équipes de `size` Aniimo : pour chaque rôle, on garde les meilleurs candidats (selon la
 * tier list et l'ennemi visé), puis on essaie toutes leurs combinaisons. Une même espèce n'apparaît
 * qu'une fois par équipe.
 */
export function bestTeams(pool: readonly Fighter[], o: TeamOptions = {}, count = 5): Team[] {
  const size = o.size ?? 4;
  const locked = pool.filter((f) => o.locked?.includes(f.id));
  const rest = pool.filter((f) => !o.locked?.includes(f.id));
  const single = (f: Fighter) => evaluate([f], { ...o }).total + 0.6 * 3; // valeur individuelle, sans pénalité de rôles
  const shortlist = new Set<Fighter>();
  for (const slot of SLOTS) {
    rest
      .filter((f) => slot.some((r) => f.roles.includes(r)))
      .sort((a, b) => single(b) - single(a))
      .slice(0, 8)
      .forEach((f) => shortlist.add(f));
  }
  [...rest].sort((a, b) => single(b) - single(a)).slice(0, 8).forEach((f) => shortlist.add(f));
  const cands = [...shortlist];

  const teams: Team[] = [];
  const need = size - locked.length;
  const pick = (start: number, chosen: Fighter[]) => {
    if (chosen.length === need) {
      const members = [...locked, ...chosen];
      const species = new Set(members.map((m) => m.species));
      if (species.size === members.length) teams.push(evaluate(members, o));
      return;
    }
    for (let i = start; i < cands.length; i++) pick(i + 1, [...chosen, cands[i]]);
  };
  if (need <= 0) return [evaluate(locked.slice(0, size), o)];
  pick(0, []);

  teams.sort((a, b) => b.total - a.total);
  // Des équipes variées : pas deux fois le même attaquant principal.
  const out: Team[] = [];
  const carries = new Set<string>();
  for (const t of teams) {
    const carry = [...t.members].filter((m) => m.roles.includes('dps')).sort((a, b) => b.score - a.score)[0]?.id ?? t.members[0].id;
    if (carries.has(carry)) continue;
    carries.add(carry);
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}
