import { useEffect, useRef, useState } from 'react';
import { ANIIMO_BY_ID, fullName } from '../data/aniimo';
import binUrl from '../data/portraits.gen.bin?url';
import meta from '../data/portraits.gen.json';
import { identify, SIDE, type Reference, type Rgba } from '../engine/portrait';
import type { ProfileApi } from '../state/profile';
import { AniimoPicker } from './AniimoPicker';
import { AbilityList, Avatar } from './ui';

let refsPromise: Promise<Reference[]> | null = null;
/** Références des portraits officiels (1 Mo, chargé au premier usage puis gardé en cache). */
function loadRefs(): Promise<Reference[]> {
  refsPromise ??= fetch(binUrl)
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      const bytes = new Uint8Array(buf);
      const refs: Reference[] = [];
      const px = SIDE * SIDE;
      meta.ids.forEach((id, i) => {
        for (let w = 0; w < meta.windows; w++) {
          const o = (i * meta.windows + w) * px * 4;
          const rgb = new Float32Array(px * 3);
          const mask = new Float32Array(px);
          for (let p = 0; p < px; p++) {
            rgb[p * 3] = bytes[o + p * 4] / 255;
            rgb[p * 3 + 1] = bytes[o + p * 4 + 1] / 255;
            rgb[p * 3 + 2] = bytes[o + p * 4 + 2] / 255;
            mask[p] = bytes[o + p * 4 + 3] ? 1 : 0;
          }
          refs.push({ key: id, rgb, mask });
        }
      });
      return refs;
    });
  return refsPromise;
}

const MAX_WIDTH = 1600;

interface Tap {
  x: number;
  y: number;
  size: number;
  candidates: { key: string; score: number }[] | null;
  chosen: string | null;
}

/**
 * Ajout d'ouvriers depuis une capture de la liste « Aniimo » du logis : on touche chaque portrait,
 * AniiGuide propose les Aniimo qui lui ressemblent le plus, on confirme d'un geste.
 */
export function CaptureImport({ api, onClose }: { api: ProfileApi; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<Rgba | null>(null);
  const [size, setSize] = useState(0);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = taps.length ? taps[taps.length - 1] : null;

  useEffect(() => {
    loadRefs().catch(() => setError('Impossible de charger les portraits de référence (connexion ?).'));
  }, []);

  const open = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_WIDTH / bitmap.width);
      const c = canvas.current!;
      c.width = Math.round(bitmap.width * scale);
      c.height = Math.round(bitmap.height * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      setImg({ data: data.data, width: c.width, height: c.height });
      // Taille d'une case : ~8 % de la largeur sur PC (paysage), ~17 % sur téléphone (portrait).
      setSize(Math.round(c.width * (c.width > c.height ? 0.082 : 0.17)));
      setTaps([]);
    } catch {
      setError("Image illisible. Essaie une capture d'écran au format PNG ou JPEG.");
    }
  };

  // Dessine la capture et les cases touchées.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    ctx.lineWidth = Math.max(2, img.width / 400);
    ctx.font = `bold ${Math.round(size / 4)}px system-ui, sans-serif`;
    taps.forEach((t, i) => {
      ctx.strokeStyle = t.chosen ? '#2e9d62' : '#7c6cf0';
      ctx.strokeRect(t.x - t.size / 2, t.y - t.size / 2, t.size, t.size);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(String(i + 1), t.x - t.size / 2 + 4, t.y - t.size / 2 + size / 4);
    });
  }, [img, taps, size]);

  const onTap = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!img) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * img.width;
    const y = ((e.clientY - rect.top) / rect.height) * img.height;
    const tap: Tap = { x, y, size, candidates: null, chosen: null };
    // Une case non confirmée est remplacée par le nouveau toucher.
    setTaps((t) => [...(t.length && !t[t.length - 1].chosen ? t.slice(0, -1) : t), tap]);
    const refs = await loadRefs();
    await new Promise((r) => setTimeout(r, 0));
    const candidates = identify(img, x, y, size, refs, 5);
    setTaps((t) => t.map((u) => (u === tap ? { ...u, candidates } : u)));
  };

  const choose = (i: number, id: string) => {
    api.addWorker(id);
    setTaps((t) => t.map((u, k) => (k === i ? { ...u, chosen: id } : u)));
  };
  const undo = (i: number) => {
    const t = taps[i];
    if (t.chosen) {
      const w = [...api.profile.workers].reverse().find((x) => x.aniimoId === t.chosen);
      if (w) api.removeWorker(w.uid);
    }
    setTaps(taps.filter((_, k) => k !== i));
  };

  const added = taps.filter((t) => t.chosen).length;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ajouter depuis une capture" onClick={onClose}>
      <div className="modal__panel modal__panel--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Ajouter depuis une capture</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        {!img && (
          <>
            <ol className="steps">
              <li>
                En jeu, ouvre la liste des Aniimo du logis (onglet <b>Aniimo</b>, « Zone de production ») et fais une capture d'écran.
              </li>
              <li>Charge la capture ici, puis touche chaque portrait.</li>
              <li>AniiGuide propose les Aniimo les plus ressemblants : vérifie avec les pastilles de capacités et confirme.</li>
            </ol>
            <label className="btn btn--primary">
              📸 Choisir une capture
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
            </label>
          </>
        )}
        {error && <p className="bad">{error}</p>}
        <div className={img ? 'capture' : 'capture capture--empty'}>
          <canvas ref={canvas} className="capture__img" onClick={onTap} />
        </div>
        {img && (
          <>
            <label className="stat capture__size">
              <span>Taille d'une case (cadre violet)</span>
              <input type="range" min={Math.round(img.width * 0.03)} max={Math.round(img.width * 0.3)} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </label>
            <p className="hint">
              Touche le centre d'un portrait. Si le cadre ne l'entoure pas bien, ajuste la taille puis touche à nouveau. {added} ajouté
              {added > 1 ? 's' : ''}.
            </p>
          </>
        )}
        {current && !current.chosen && (
          <div className="capture__pick">
            <h3>Portrait n° {taps.length} : lequel est-ce ?</h3>
            {!current.candidates ? (
              <p className="muted">Recherche…</p>
            ) : (
              <ul className="pick-list">
                {current.candidates.map((c) => {
                  const a = ANIIMO_BY_ID.get(c.key)!;
                  return (
                    <li key={c.key}>
                      <button type="button" className="pick-row" onClick={() => choose(taps.length - 1, c.key)}>
                        <Avatar aniimo={a} size={48} />
                        <span className="pick-row__text">
                          <strong>{fullName(a)}</strong>
                          <AbilityList levels={a.homeland} />
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button type="button" className="link" onClick={() => setPicking(taps.length - 1)}>
                    Aucun de ceux-là : chercher par nom
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
        {taps.some((t) => t.chosen) && (
          <div className="chips">
            {taps.map((t, i) =>
              t.chosen ? (
                <button key={i} type="button" className="chip chip--btn" onClick={() => undo(i)} title="Annuler">
                  {i + 1}. {fullName(ANIIMO_BY_ID.get(t.chosen)!)} ✕
                </button>
              ) : null,
            )}
          </div>
        )}
        {img && (
          <div className="row">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Terminé
            </button>
          </div>
        )}
        {picking != null && (
          <AniimoPicker
            onClose={() => setPicking(null)}
            onPick={(id) => {
              choose(picking, id);
              setPicking(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
