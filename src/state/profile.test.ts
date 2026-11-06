import { describe, expect, it } from 'vitest';
import { sanitizeProfile } from './profile';
import { currentId } from '../data/aniimo';

describe('profil enregistré avant un renommage de forme', () => {
  it('anciens identifiants de forme convertis (29/10/2026)', () => {
    expect(currentId('001-mountain-woods-form')).toBe('001-timberline-form');
    expect(currentId('013-sea-of-flowers-form')).toBe('013-flowerfield-form');
    expect(currentId('006-rainstorm-form')).toBe('006-rainfall-form');
    expect(currentId('005-basic-form')).toBe('005-basic-form');
  });

  it('ouvriers et collection gardés, sous le nouvel identifiant', () => {
    const p = sanitizeProfile({
      version: 1,
      rv: 8,
      workers: [{ uid: 'a', aniimoId: '001-mountain-woods-form', personality: null }],
      collection: ['013-sea-of-flowers-form', '005-basic-form'],
    });
    expect(p.workers.map((w) => w.aniimoId)).toEqual(['001-timberline-form']);
    expect(p.collection).toEqual(['013-flowerfield-form', '005-basic-form']);
  });
});
