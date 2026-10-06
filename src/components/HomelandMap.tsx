import { useEffect, useMemo, useState } from 'react';
import { facilityName, itemName } from '../data/homeland';
import { climateLayout } from '../engine/homeland/climate';
import { openCells, PLOT_GRID, PLOT_SIZE, type HomelandPlan, type PlacedPiece } from '../engine/homeland/homeland-plan';
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
const colorOf = (f: string) => COLORS[f] ?? (['tidewhisper-sandcastle', 'dewy-house', 'nimbus-bed', 'starfall-hammock', 'floral-windmill'].includes(f) ? '#e8678a' : '#7c6cf0');
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
    worker.postMessage({ rows: result.rows, whole: result.rows.map((r) => whole.get(r) ?? 0), climate: climateLayout(result, result.rows, whole), rv, machines: result.machines });
  };

  return (
    <section className="card">
      <h2>Plan du logis</h2>
      <p className="hint">
        Toutes les installations du plan posées sur ton terrain ouvert au niveau {rv}, autour de l'Entrepôt. Les Aniimo transporteurs y
        rapportent chaque lot terminé : les installations les plus fréquentées sont donc au plus près, et les zones climatiques gardent leurs
        parcelles. 1 carreau = 1 case du mode Construire.
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

function TerrainMap({ plan, rv }: { plan: HomelandPlan; rv: number }) {
  const open = useMemo(() => new Set(openCells(rv).map((c) => c.plot)), [rv]);
  // Cadrage : le terrain ouvert, avec une marge.
  const xs = plan.cells.flatMap((c) => [c.x, c.x + c.w]);
  const ys = plan.cells.flatMap((c) => [c.y, c.y + c.h]);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1];
  // Numéros de légende : un par installation et production.
  const kinds = [...new Set(plan.pieces.map((p) => `${p.facility}|${p.item ?? ''}`))];
  const num = (p: PlacedPiece) => kinds.indexOf(`${p.facility}|${p.item ?? ''}`) + 1;

  return (
    <>
      <div className="homeland-map">
        <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} role="img" aria-label="Plan du logis">
          {PLOT_GRID.flatMap((row, j) =>
            row.map((plot, i) => {
              const isOpen = open.has(plot);
              const x = i * PLOT_SIZE.w, y = j * PLOT_SIZE.h;
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
          {plan.pieces
            .filter((p) => ENV_FACILITIES.has(p.facility))
            .map((p, k) => (
              <rect key={`z${k}`} x={p.rect.x + p.rect.w / 2 - 4.5} y={p.rect.y + p.rect.h / 2 - 4.5} width={9} height={9} fill={colorOf(p.facility)} fillOpacity={0.1} stroke={colorOf(p.facility)} strokeWidth={0.12} strokeDasharray="0.4 0.25" />
            ))}
          {plan.pieces.map((p, k) => (
            <g key={k}>
              <rect x={p.rect.x + 0.05} y={p.rect.y + 0.05} width={p.rect.w - 0.1} height={p.rect.h - 0.1} rx={0.2} fill={colorOf(p.facility)} fillOpacity={0.88}>
                <title>
                  {facilityName(p.facility).name}
                  {p.item ? ` · ${itemName(p.item).name}` : ''}
                  {p.trips > 0 ? ` · ${p.trips.toFixed(1).replace('.', ',')} lots/h` : ''}
                </title>
              </rect>
              <text x={p.rect.x + p.rect.w / 2} y={p.rect.y + p.rect.h / 2} className="hm-label" fontSize={Math.min(p.rect.w, p.rect.h) * 0.5}>
                {num(p)}
              </text>
            </g>
          ))}
          <rect x={plan.storage.x} y={plan.storage.y} width={plan.storage.w} height={plan.storage.h} rx={0.2} className="hm-storage" />
          <text x={plan.storage.x + plan.storage.w / 2} y={plan.storage.y + plan.storage.h / 2} className="hm-label" fontSize={1.2}>
            📦
          </text>
        </svg>
      </div>
      <ul className="hm-legend">
        <li>
          <span className="hm-key hm-key--storage">📦</span> Entrepôt du logis
        </li>
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
          Pas de place pour : {plan.unplaced.map((u) => facilityName(u.facility).name).join(', ')}. Ouvre une parcelle de terrain de plus ou
          range des décorations.
        </p>
      )}
    </>
  );
}
