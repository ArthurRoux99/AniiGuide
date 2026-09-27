import { useEffect, useRef, useState } from 'react';
import { ANIIMO_BY_ID, fullName } from '../data/aniimo';
import binUrl from '../data/portraits.gen.bin?url';
import meta from '../data/portraits.gen.json';
import { detectTiles, identify, rankWithBadges, readBadges, SIDE, type Reference, type Rgba } from '../engine/portrait';
import type { ProfileApi } from '../state/profile';
import { AniimoPicker } from './AniimoPicker';
import { AbilityList } from './ui';

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
const tick = () => new Promise((r) => setTimeout(r, 0));

interface Item {
  x: number;
  y: number;
  size: number;
  thumb: string;
  candidates: { key: string; score: number }[] | null;
  chosen: string | null;
  include: boolean;
}

/**
 * Ajout d'ouvriers depuis une capture de la liste « Aniimo » du logis : les cases sont repérées
 * automatiquement, chaque portrait est comparé aux portraits officiels, et le joueur valide la
 * liste (en corrigeant au besoin). Une case manquée se touche à la main.
 */
export function CaptureImport({ api, onClose }: { api: ProfileApi; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<Rgba | null>(null);
  const [size, setSize] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    loadRefs().catch(() => setError('Impossible de charger les portraits de référence (connexion ?).'));
  }, []);

  const thumb = (x: number, y: number, s: number) => {
    const c = document.createElement('canvas');
    c.width = c.height = 72;
    c.getContext('2d')!.drawImage(source.current!, x - s / 2, y - s / 2, s, s, 0, 0, 72, 72);
    return c.toDataURL('image/jpeg', 0.7);
  };

  /** Reconnaît les cases données, une à une (l'écran reste réactif). */
  const recognize = async (image: Rgba, cells: { x: number; y: number; size: number }[]) => {
    const refs = await loadRefs();
    const owned = new Map<string, number>();
    for (const w of api.profile.workers) owned.set(w.aniimoId, (owned.get(w.aniimoId) ?? 0) + 1);
    const out: Item[] = [];
    for (const [k, c] of cells.entries()) {
      setBusy(`Reconnaissance ${k + 1}/${cells.length}…`);
      await tick();
      // Ressemblance du portrait, puis concordance avec les pastilles de capacités sous la case.
      const badges = readBadges(image, c.x, c.y, c.size);
      const candidates = rankWithBadges(identify(image, c.x, c.y, c.size, refs, 999), badges, (key) => Object.keys(ANIIMO_BY_ID.get(key)?.homeland ?? {})).slice(0, 5);
      const chosen = candidates[0]?.key ?? null;
      // Déjà au logis (autant d'exemplaires) : décoché, pour ne pas le compter deux fois.
      const left = chosen ? (owned.get(chosen) ?? 0) : 0;
      if (chosen && left > 0) owned.set(chosen, left - 1);
      out.push({ ...c, thumb: thumb(c.x, c.y, c.size), candidates, chosen, include: left === 0 });
    }
    setBusy(null);
    return out;
  };

  const open = async (file: File) => {
    try {
      setError(null);
      setDone(null);
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_WIDTH / bitmap.width);
      const c = document.createElement('canvas');
      c.width = Math.round(bitmap.width * scale);
      c.height = Math.round(bitmap.height * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      source.current = c;
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const image = { data: data.data, width: c.width, height: c.height };
      setImg(image);
      const cells = detectTiles(image);
      setSize(cells[0]?.size ?? Math.round(c.width * (c.width > c.height ? 0.082 : 0.17)));
      setItems([]);
      if (!cells.length) {
        setError('Aucune case repérée automatiquement : touche chaque portrait sur la capture.');
        return;
      }
      setItems(await recognize(image, cells));
    } catch {
      setError("Image illisible. Essaie une capture d'écran au format PNG ou JPEG.");
    }
  };

  // Dessine la capture et les cases retenues.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !img || !source.current) return;
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(source.current, 0, 0);
    ctx.lineWidth = Math.max(2, img.width / 400);
    ctx.font = `bold ${Math.round(size / 4)}px system-ui, sans-serif`;
    items.forEach((t, i) => {
      ctx.strokeStyle = t.include ? '#2e9d62' : '#8e8ea0';
      ctx.strokeRect(t.x - t.size / 2, t.y - t.size / 2, t.size, t.size);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(String(i + 1), t.x - t.size / 2 + 4, t.y - t.size / 2 + t.size / 4);
    });
  }, [img, items, size]);

  const onTap = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!img || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * img.width;
    const y = ((e.clientY - rect.top) / rect.height) * img.height;
    const hit = items.findIndex((t) => Math.abs(t.x - x) < t.size / 2 && Math.abs(t.y - y) < t.size / 2);
    if (hit >= 0) {
      // Toucher une case déjà repérée : la (dé)cocher.
      setItems(items.map((t, k) => (k === hit ? { ...t, include: !t.include } : t)));
      return;
    }
    const [item] = await recognize(img, [{ x, y, size }]);
    setItems((cur) => [...cur, { ...item, include: true }]);
  };

  const update = (i: number, patch: Partial<Item>) => setItems(items.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  const selected = items.filter((t) => t.include && t.chosen);

  const commit = () => {
    for (const t of selected) api.addWorker(t.chosen!);
    setDone(selected.length);
    setItems([]);
    setImg(null);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ajouter depuis une capture" onClick={onClose}>
      <div className="modal__panel modal__panel--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Ajouter depuis une capture</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        {done != null && (
          <p className="good">
            ✓ {done} ouvrier{done > 1 ? 's' : ''} ajouté{done > 1 ? 's' : ''}. La liste en jeu défile : charge la capture suivante pour les autres.
          </p>
        )}
        {!img && (
          <>
            <ol className="steps">
              <li>
                En jeu, ouvre la liste des Aniimo du logis (onglet <b>Aniimo</b>, « Zone de production ») et fais une capture d'écran.
              </li>
              <li>Charge-la ici : les portraits sont repérés et reconnus automatiquement.</li>
              <li>Vérifie la liste, surtout le stade d'évolution (niveaux des capacités), corrige si besoin, puis ajoute.</li>
            </ol>
            <label className="btn btn--primary">
              📸 Choisir une capture
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
            </label>
          </>
        )}
        {error && <p className="bad">{error}</p>}
        {img && (
          <>
            <div className="capture">
              <canvas ref={canvas} className="capture__img" onClick={onTap} />
            </div>
            <p className="hint">
              Touche une case encadrée pour l'écarter ou la reprendre. Une case oubliée (la case sélectionnée en jeu, par exemple) : touche le
              centre de son portrait.
            </p>
          </>
        )}
        {busy && <p className="muted">{busy}</p>}
        {items.length > 0 && (
          <ul className="capture-list">
            {items.map((t, i) => (
              <li key={i} className={t.include ? '' : 'is-off'}>
                <input type="checkbox" checked={t.include} onChange={(e) => update(i, { include: e.target.checked })} aria-label={`Garder la case ${i + 1}`} />
                <img src={t.thumb} alt={`Case ${i + 1}`} width={56} height={56} />
                <div className="capture-list__body">
                  <select
                    value={t.chosen ?? ''}
                    onChange={(e) => (e.target.value === '*' ? setPicking(i) : update(i, { chosen: e.target.value, include: true }))}
                    aria-label={`Aniimo de la case ${i + 1}`}
                  >
                    {t.chosen && !t.candidates?.some((c) => c.key === t.chosen) && <option value={t.chosen}>{fullName(ANIIMO_BY_ID.get(t.chosen)!)}</option>}
                    {t.candidates?.map((c) => (
                      <option key={c.key} value={c.key}>
                        {fullName(ANIIMO_BY_ID.get(c.key)!)}
                      </option>
                    ))}
                    <option value="*">Autre… (chercher)</option>
                  </select>
                  {t.chosen && <AbilityList levels={ANIIMO_BY_ID.get(t.chosen)!.homeland} />}
                  {!t.include && api.profile.workers.some((w) => w.aniimoId === t.chosen) && <small className="muted">déjà au logis</small>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {img && (
          <div className="row">
            <button type="button" className="btn btn--primary" disabled={!selected.length || !!busy} onClick={commit}>
              Ajouter {selected.length} ouvrier{selected.length > 1 ? 's' : ''}
            </button>
            <button type="button" className="btn" onClick={() => (setImg(null), setItems([]))}>
              Autre capture
            </button>
          </div>
        )}
        {picking != null && (
          <AniimoPicker
            onClose={() => setPicking(null)}
            onPick={(id) => {
              update(picking, { chosen: id, include: true });
              setPicking(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
