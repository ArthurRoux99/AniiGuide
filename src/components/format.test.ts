import { describe, expect, it } from 'vitest';
import { fmtDuration, parseDuration } from './format';

describe('durées', () => {
  it('lit les durées saisies', () => {
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('90 s')).toBe(90);
    expect(parseDuration('1 min 30')).toBe(90);
    expect(parseDuration('2h 5min')).toBe(7500);
    expect(parseDuration('1,5 min')).toBe(90);
    expect(parseDuration('')).toBeNull();
  });
  it('affiche les durées', () => {
    expect(fmtDuration(0.5)).toBe('30 min');
    expect(fmtDuration(5 + 7 / 60)).toBe('5 h 07');
    expect(fmtDuration(76)).toBe('3 j 4 h');
  });
});
