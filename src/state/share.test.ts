import { describe, expect, it } from 'vitest';
import { decodeProfile, encodeProfile } from './share';
import { exampleProfile } from './profile';

describe('partage du profil', () => {
  it('aller-retour sans perte, en un lien court', async () => {
    const p = { ...exampleProfile(), collection: ['005-basic-form'], usedCodes: ['aniimonow'] };
    p.workers[0].personality = 'ENTP';
    const code = await encodeProfile(p);
    expect(code.length).toBeLessThan(1200);
    const back = await decodeProfile(code);
    expect(back.rv).toBe(p.rv);
    expect(back.stock).toEqual(p.stock);
    expect(back.workers.map((w) => [w.aniimoId, w.personality])).toEqual(p.workers.map((w) => [w.aniimoId, w.personality]));
    expect(back.collection).toEqual(p.collection);
    expect(back.usedCodes).toEqual(p.usedCodes);
  });
});
