import { describe, expect, it } from 'vitest';
import { efficiency, wateredSeconds, workSeconds } from './speed';

// Valeurs relevées en jeu (documentées par Aniimax).
describe('vitesse de travail', () => {
  it('transformation : 100 %, 300 %, 400 %, 500 %', () => {
    expect(efficiency(1, 1, false)).toBe(1);
    expect(efficiency(2, 1, false)).toBe(3);
    expect(efficiency(3, 1, false)).toBe(4);
    expect(efficiency(4, 1, false)).toBe(5);
    expect(efficiency(3, 2, false)).toBe(3);
  });

  it('collecte : Eau de puits 150/200/250 %, Sel de mer rapide 140/180 %', () => {
    expect(efficiency(2, 1, true)).toBe(1.5);
    expect(efficiency(4, 1, true)).toBe(2.5);
    expect(efficiency(3, 2, true)).toBeCloseTo(1.4);
    expect(efficiency(4, 2, true)).toBeCloseTo(1.8);
  });

  it('un lot de 108 de charge : 108 s, 36 s, 30 s avec la bonne personnalité', () => {
    const base = { facility: 'jukebox-dryer', workload: 108, required: 1, gathering: false };
    expect(workSeconds({ ...base, level: 1, personality: false })).toBe(108);
    expect(workSeconds({ ...base, level: 2, personality: false })).toBe(36);
    expect(workSeconds({ ...base, level: 2, personality: true })).toBeCloseTo(30);
  });

  it("Argile (niv. 2, 2 250 de charge) : 21 min 26 s à 140 %", () => {
    const s = workSeconds({ facility: 'mine', workload: 2250, required: 2, level: 3, personality: false, gathering: true });
    expect(s).toBeCloseTo(21 * 60 + 26, 0);
  });

  it('arrosage : 40 min → 30 min, 4 min → 3 min', () => {
    expect(wateredSeconds(2400)).toBe(1800);
    expect(wateredSeconds(240)).toBe(180);
  });
});
