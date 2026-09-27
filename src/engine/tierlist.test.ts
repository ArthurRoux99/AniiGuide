import { describe, expect, it } from 'vitest';
import { consensus, sourceScore, tierOf, type TierSource } from './tierlist';
import sources from '../data/tierlists.gen.json';

const src = (id: string, scale: string[], entries: [string, string][]): TierSource => ({
  id, source: id, url: '', note: null, pageDate: null, fetchedAt: '', scale, entries: entries.map(([e, tier]) => ({ id: e, tier })),
});

describe('consensus', () => {
  it('convertit chaque barème en note de 0 à 1', () => {
    expect(sourceScore(['S+', 'S', 'A', 'B'], 'S+')).toBe(1);
    expect(sourceScore(['S+', 'S', 'A', 'B'], 'B')).toBe(0);
    expect(sourceScore(['S', 'A', 'B', 'C', 'D'], 'B')).toBe(0.5);
    expect(sourceScore(['S', 'A'], 'Z')).toBeNull();
  });

  it('moyenne les sources et garde le détail des votes', () => {
    const c = consensus([src('a', ['S', 'A', 'B', 'C', 'D'], [['x', 'S'], ['y', 'D']]), src('b', ['SS', 'S', 'A', 'B'], [['x', 'S'], ['y', 'B']])]);
    const x = c.find((e) => e.id === 'x')!;
    expect(x.score).toBeCloseTo((1 + 2 / 3) / 2);
    expect(x.tier).toBe('S');
    expect(x.votes).toHaveLength(2);
    expect(c[0].id).toBe('x');
    expect(c.find((e) => e.id === 'y')!.tier).toBe('D');
    expect(tierOf(0.5)).toBe('B');
  });

  it('données réelles : Lunara (starter) est classé haut par toutes les sources', () => {
    const c = consensus(sources as TierSource[]);
    const lunara = c.find((e) => e.id === '99996-basic-form' || e.id.endsWith('Lunara'));
    expect(lunara).toBeDefined();
    expect(['S', 'A']).toContain(lunara!.tier);
    expect(lunara!.votes.length).toBeGreaterThanOrEqual(4);
  });
});
