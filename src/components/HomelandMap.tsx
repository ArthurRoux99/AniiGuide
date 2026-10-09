import { useEffect, useMemo, useState } from 'react';
import { facilityName, itemName } from '../data/homeland';
import { climateLayout } from '../engine/homeland/climate';
import { openCells, PLOT_GRID, PLOT_SIZE, type HomelandPlan, type PlacedPiece } from '../engine/homeland/homeland-plan';
import { GENERATOR, POLE } from '../engine/homeland/power-layout';
import type { Plan, PlanRow } from '../engine/homeland/optimize';
import HomelandWorker from '../workers/homeland.worker?worker&inline';

const COLORS: Record<string, string> = {
  farmland: '#b07a3a',
  woodland: '#3f8f4f',
  'heat-furnace': '#e5484d',
  'cooling-unit': '#3e8ed0',
  sunlamp: '#d6b800',
  mine: '#7a7f8c',
  well: '#4aa3df',
};
const colorOf = (f: string) =>
  COLORS[f] ?? (['tidewhisper-sandcastle', 'dewy-house', 'nimbus-bed', 'starfall-hammock', 'floral-windmill'].includes(f) ? '#e8678a' : '#7c6cf0');
const ENV_FACILITIES = new Set(['heat-furnace', 'cooling-unit', 'sunlamp']);

/**
 * Plan complet du logis : toutes les installations du plan sur le vrai terrain (parcelles ouvertes
 * à ce niveau), autour de l'Entrepôt, les plus fréquentées au plus près.
 */
export function HomelandMap({ result, whole, rv }: { result: Plan; whole: Map<PlanRow, number>; rv: number }) {
  const [plan, setPlan] = useState<HomelandPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPlan(null), [result, rv]);

  const compute = () => {
    setBusy(true);
    setError(null);
    const worker = new HomelandWorker();
    worker.onmessage = (e: MessageEvent<HomelandPlan>) => {
      setPlan(e.data);
      setBusy(false);
      worker.terminate();
    };
    worker.onerror = () => {
      setError('Le calcul du plan a échoué.');
      setBusy(false);
      worker.terminate();
    };
    worker.postMessage({
      rows: result.rows,
      whole: result.rows.map((r) => whole.get(r) ?? 0),
      climate: climateLayout(result, result.rows, whole),
      rv,
      machines: result.machines,
    });
  };

  return (
    <section className="card">
      <h2>Plan du logis</h2>
      <p className="hint">
        Toutes les installations du plan posées sur ton terrain ouvert au niveau {rv}, autour de l'Entrepôt. Les Aniimo transporteurs y rapportent
        chaque lot terminé : les installations les plus fréquentées sont donc au plus près, et les zones climatiques gardent leurs parcelles. 1
        carreau = 1 case du mode Construire.
      </p>
      {!plan && (
        <button type="button" className="btn btn--primary" onClick={compute} disabled={busy}>
          {busy ? 'Calcul du plan…' : '🗺️ Calculer le plan du logis'}
        </button>
      )}
      {error && <p className="bad">{error}</p>}
      {plan && <TerrainMap plan={plan} rv={rv} />}
      <p className="hint">Tailles des installations, terrain et méthode de placement : projet Aniimax (MIT), relevés en jeu.</p>
    </section>
  );
}

const GEN_COLOR = '#f2b705';
const zoneOf = (r: { x: number; y: number; w: number; h: number }, range: number) => ({
  x: r.x + r.w / 2 - range / 2,
  y: r.y + r.h / 2 - range / 2,
  w: range,
  h: range,
});
const fmtCase = (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace('.', ','));

/** Parcelle (numéro et coin haut-gauche) qui contient le coin haut-gauche d'un rectangle. */
function plotOf(r: { x: number; y: number }) {
  const i = Math.min(3, Math.max(0, Math.floor(r.x / PLOT_SIZE.w)));
  const j = Math.min(3, Math.max(0, Math.floor(r.y / PLOT_SIZE.h)));
  return { plot: PLOT_GRID[j][i], x0: i * PLOT_SIZE.w, y0: j * PLOT_SIZE.h };
}

interface Spot {
  key: string;
  label: string;
  item?: string;
  color: string;
  rect: { x: number; y: number; w: number; h: number };
  plot: number;
  col: number;
  row: number;
  electric?: boolean;
  unpowered?: boolean;
}

function TerrainMap({ plan, rv }: { plan: HomelandPlan; rv: number }) {
  const open = useMemo(() => new Set(openCells(rv).map((c) => c.plot)), [rv]);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // Bâtiments déjà posés en jeu, gardés pour ce plan précis (dans ce navigateur).
  const storeKey = `aniiguide.pose.${rv}.${Math.round(plan.walk)}.${plan.pieces.length}`;
  const [done, setDone] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storeKey) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const toggle = (k: string) => {
    const next = new Set(done);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setDone(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify([...next]));
    } catch {
      /* stockage indisponible : la coche reste pour la session */
    }
  };

  // Numéros de légende : un par installation et production.
  const kinds = [...new Set(plan.pieces.map((p) => `${p.facility}|${p.item ?? ''}`))];
  const num = (p: PlacedPiece) => kinds.indexOf(`${p.facility}|${p.item ?? ''}`) + 1;

  // Tout ce qu'il faut poser, avec sa parcelle et sa position dans la parcelle (en cases).
  const spots: Spot[] = useMemo(() => {
    const at = (rect: Spot['rect']) => {
      const p = plotOf(rect);
      return { plot: p.plot, col: rect.x - p.x0 + 1, row: rect.y - p.y0 + 1 };
    };
    const list: Spot[] = [
      {
        key: 'storage',
        label: 'Entrepôt du logis',
        color: '#2b2d42',
        rect: plan.storage,
        ...at(plan.storage),
      },
    ];
    if (plan.power?.generator)
      list.push({
        key: 'gen',
        label: 'Générateur crépitant',
        color: GEN_COLOR,
        rect: plan.power.generator,
        ...at(plan.power.generator),
      });
    plan.power?.poles.forEach((r, i) =>
      list.push({
        key: `pole${i}`,
        label: 'Poteau électrique crépitant',
        color: GEN_COLOR,
        rect: r,
        ...at(r),
      }),
    );
    plan.pieces.forEach((p, i) =>
      list.push({
        key: `p${i}`,
        label: facilityName(p.facility).name,
        item: p.item ? itemName(p.item).name : undefined,
        color: colorOf(p.facility),
        rect: p.rect,
        electric: p.electric,
        unpowered: p.unpowered,
        ...at(p.rect),
      }),
    );
    // L'Entrepôt d'abord (point de repère), puis parcelle par parcelle, de haut en bas et de gauche à droite.
    return list.sort((a, b) => Number(b.key === 'storage') - Number(a.key === 'storage') || a.plot - b.plot || a.row - b.row || a.col - b.col);
  }, [plan]);
  const plots = [...new Set(spots.map((s) => s.plot))].sort((a, b) => a - b);

  // Cadrage : tout le terrain utilisé, ou une seule parcelle en mode pas à pas.
  const fp =
    focus != null
      ? PLOT_GRID.flatMap((row, j) => row.map((n, i) => ({ n, x: i * PLOT_SIZE.w, y: j * PLOT_SIZE.h }))).find((c) => c.n === focus)!
      : null;
  const xs = plan.cells.flatMap((c) => [c.x, c.x + c.w]);
  const ys = plan.cells.flatMap((c) => [c.y, c.y + c.h]);
  const [x0, x1, y0, y1] = fp
    ? [fp.x - 2, fp.x + PLOT_SIZE.w + 0.5, fp.y - 2, fp.y + PLOT_SIZE.h + 0.5]
    : [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1];
  const shown = focus != null ? spots.filter((s) => s.plot === focus) : spots;
  const left = spots.filter((s) => !done.has(s.key)).length;

  return (
    <>
      <div className="chips">
        <button type="button" className={`chip chip--btn${focus == null ? ' is-active' : ''}`} onClick={() => setFocus(null)}>
          Tout le logis
        </button>
        {plots.map((n) => {
          const todo = spots.filter((s) => s.plot === n && !done.has(s.key)).length;
          return (
            <button key={n} type="button" className={`chip chip--btn${focus === n ? ' is-active' : ''}`} onClick={() => setFocus(n)}>
              Parcelle {n} {todo ? <span className="muted">({todo})</span> : '✓'}
            </button>
          );
        })}
      </div>
      <div className="homeland-map">
        <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} role="img" aria-label={focus != null ? `Parcelle ${focus}` : 'Plan du logis'}>
          {PLOT_GRID.flatMap((row, j) =>
            row.map((plot, i) => {
              const isOpen = open.has(plot);
              const x = i * PLOT_SIZE.w,
                y = j * PLOT_SIZE.h;
              if (x + PLOT_SIZE.w < x0 || x > x1 || y + PLOT_SIZE.h < y0 || y > y1) return null;
              return (
                <g key={plot}>
                  <rect x={x} y={y} width={PLOT_SIZE.w} height={PLOT_SIZE.h} className={isOpen ? 'hm-plot' : 'hm-plot hm-plot--locked'} />
                  {!isOpen && (
                    <text x={x + PLOT_SIZE.w / 2} y={y + PLOT_SIZE.h / 2} className="hm-locked">
                      niv. {plot}
                    </text>
                  )}
                </g>
              );
            }),
          )}
          {fp && (
            // Grille case par case (trait plus marqué toutes les 5 cases) et numéros des colonnes et lignes.
            <g className="hm-grid">
              {Array.from({ length: PLOT_SIZE.w + 1 }, (_, k) => (
                <line key={`v${k}`} x1={fp.x + k} y1={fp.y} x2={fp.x + k} y2={fp.y + PLOT_SIZE.h} className={k % 5 ? '' : 'hm-grid--5'} />
              ))}
              {Array.from({ length: PLOT_SIZE.h + 1 }, (_, k) => (
                <line key={`h${k}`} x1={fp.x} y1={fp.y + k} x2={fp.x + PLOT_SIZE.w} y2={fp.y + k} className={k % 5 ? '' : 'hm-grid--5'} />
              ))}
              {Array.from({ length: PLOT_SIZE.w }, (_, k) => (
                <text key={`c${k}`} x={fp.x + k + 0.5} y={fp.y - 0.7} className="hm-axis">
                  {k + 1}
                </text>
              ))}
              {Array.from({ length: PLOT_SIZE.h }, (_, k) => (
                <text key={`r${k}`} x={fp.x - 0.9} y={fp.y + k + 0.5} className="hm-axis">
                  {k + 1}
                </text>
              ))}
            </g>
          )}
          {fp && (
            <defs>
              <clipPath id="hm-plot-clip">
                <rect x={fp.x} y={fp.y} width={PLOT_SIZE.w} height={PLOT_SIZE.h} />
              </clipPath>
            </defs>
          )}
          <g clipPath={fp ? 'url(#hm-plot-clip)' : undefined}>
            {plan.pieces
              .filter((p) => ENV_FACILITIES.has(p.facility))
              .map((p, k) => (
                <rect
                  key={`z${k}`}
                  x={p.rect.x + p.rect.w / 2 - 4.5}
                  y={p.rect.y + p.rect.h / 2 - 4.5}
                  width={9}
                  height={9}
                  fill={colorOf(p.facility)}
                  fillOpacity={0.1}
                  stroke={colorOf(p.facility)}
                  strokeWidth={0.12}
                  strokeDasharray="0.4 0.25"
                />
              ))}
            {plan.power?.generator && (
              <g className="hm-power">
                {[{ r: plan.power.generator, range: GENERATOR.range }, ...plan.power.poles.map((r) => ({ r, range: POLE.range }))].map(
                  ({ r, range }, k) => {
                    const z = zoneOf(r, range);
                    return (
                      <rect
                        key={k}
                        x={z.x}
                        y={z.y}
                        width={z.w}
                        height={z.h}
                        fill={GEN_COLOR}
                        fillOpacity={0.06}
                        stroke={GEN_COLOR}
                        strokeWidth={0.12}
                        strokeDasharray="0.5 0.3"
                      />
                    );
                  },
                )}
              </g>
            )}
            {spots
              .filter(
                (s) =>
                  !fp || (s.rect.x < fp.x + PLOT_SIZE.w && s.rect.x + s.rect.w > fp.x && s.rect.y < fp.y + PLOT_SIZE.h && s.rect.y + s.rect.h > fp.y),
              )
              .map((s) => {
                const isDone = done.has(s.key);
                const lit = hover === s.key;
                const isPiece = s.key.startsWith('p');
                const p = isPiece ? plan.pieces[Number(s.key.slice(1))] : null;
                return (
                  <g key={s.key} opacity={focus != null && s.plot !== focus ? 0.35 : isDone ? 0.45 : 1}>
                    <rect
                      x={s.rect.x + 0.05}
                      y={s.rect.y + 0.05}
                      width={s.rect.w - 0.1}
                      height={s.rect.h - 0.1}
                      rx={0.2}
                      fill={s.color}
                      fillOpacity={s.key === 'storage' ? 1 : 0.88}
                      stroke={lit ? 'var(--accent)' : s.unpowered ? '#e5484d' : s.electric ? GEN_COLOR : 'none'}
                      strokeWidth={lit ? 0.4 : 0.25}
                    >
                      <title>
                        {s.label}
                        {s.item ? ` · ${s.item}` : ''}
                        {p && p.trips > 0 ? ` · ${p.trips.toFixed(1).replace('.', ',')} lots/h` : ''}
                        {s.electric ? ' · électrique' : ''}
                      </title>
                    </rect>
                    <text
                      x={s.rect.x + s.rect.w / 2}
                      y={s.rect.y + s.rect.h / 2}
                      className="hm-label"
                      fontSize={Math.max(0.6, Math.min(s.rect.w, s.rect.h) * 0.5)}
                    >
                      {s.key === 'storage' ? '📦' : s.key === 'gen' ? '⚡' : s.key.startsWith('pole') ? '•' : isDone ? '✓' : num(p!)}
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>
      </div>
      {plan.power?.generator && (
        <p className="hint">
          ⚡ Réseau électrique : le Générateur crépitant et {plan.power.poles.length} Poteau
          {plan.power.poles.length > 1 ? 'x' : ''} électrique
          {plan.power.poles.length > 1 ? 's' : ''} ; en pointillés jaunes, la zone alimentée (carré de 11 cases autour du Générateur, de 7 autour
          d'un Poteau). Un Poteau est relié au réseau quand sa zone chevauche celle du Générateur ou d'un Poteau déjà relié. Les installations
          électriques (bord jaune) doivent toucher une zone.
          {plan.pieces.some((p) => p.unpowered) && <b className="bad"> Bord rouge : hors réseau, plus de Poteaux autorisés à ce niveau.</b>}
        </p>
      )}

      <h3>
        {focus != null ? `Parcelle ${focus} : à poser` : 'Pas à pas : où poser chaque bâtiment'}{' '}
        <span className="muted">
          ({left} restant{left > 1 ? 's' : ''})
        </span>
      </h3>
      <p className="hint">
        Position = coin haut-gauche du bâtiment, en cases depuis le coin haut-gauche de sa parcelle (colonne 1 à 20, ligne 1 à 15), vue de dessus
        comme la carte du logis. Choisis une parcelle pour la voir case par case. Coche ce qui est posé : c'est gardé sur cet appareil.
      </p>
      <ul className="hm-steps">
        {shown.map((s) => (
          <li
            key={s.key}
            className={done.has(s.key) ? 'is-done' : undefined}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <label>
              <input type="checkbox" checked={done.has(s.key)} onChange={() => toggle(s.key)} />
              <span className="hm-key" style={{ background: s.color }}>
                {s.key === 'storage' ? '📦' : s.key === 'gen' ? '⚡' : s.key.startsWith('pole') ? '•' : num(plan.pieces[Number(s.key.slice(1))])}
              </span>
              <span>
                <b>{s.label}</b>
                {s.item && <span className="muted"> · {s.item}</span>}
                {s.electric && ' ⚡'}
                <br />
                <small className="muted">
                  {focus == null && `parcelle ${s.plot}, `}colonne {fmtCase(s.col)}, ligne {fmtCase(s.row)} · {fmtCase(s.rect.w)}×{fmtCase(s.rect.h)}{' '}
                  cases
                </small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {done.size > 0 && (
        <button
          type="button"
          className="link"
          onClick={() => {
            setDone(new Set());
            try {
              localStorage.removeItem(storeKey);
            } catch {
              /* rien à effacer */
            }
          }}
        >
          Tout décocher
        </button>
      )}

      <ul className="hm-legend">
        {kinds.map((k, i) => {
          const [facility, item] = k.split('|');
          const n = plan.pieces.filter((p) => `${p.facility}|${p.item ?? ''}` === k).length;
          return (
            <li key={k}>
              <span className="hm-key" style={{ background: colorOf(facility) }}>
                {i + 1}
              </span>
              {n > 1 && `${n} × `}
              {facilityName(facility).name}
              {item && <span className="muted"> · {itemName(item).name}</span>}
            </li>
          );
        })}
      </ul>
      {plan.unplaced.length > 0 && (
        <p className="bad">
          Pas de place pour : {plan.unplaced.map((u) => facilityName(u.facility).name).join(', ')}. Ouvre une parcelle de terrain de plus ou range des
          décorations.
        </p>
      )}
    </>
  );
}
