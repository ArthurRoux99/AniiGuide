import { useEffect, useState } from 'react';
import { facilityName, HOMELAND } from '../data/homeland';
import { setupForRv, type PlanOptions } from '../engine/homeland/optimize';
import { opportunities, type Opportunity } from '../engine/homeland/opportunities';
import type { ProfileApi } from '../state/profile';
import { fmtDuration } from './format';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const cost = (id: string, level: number) => HOMELAND.levels[id]?.[level - 1]?.cost ?? null;

/** Mes installations réelles (nombre, niveau) : par défaut tout au maximum du niveau. */
export function MyFacilities({ api }: { api: ProfileApi }) {
  const rv = api.profile.rv;
  const max = setupForRv(rv).facilities;
  const ids = Object.keys(max).filter((id) => max[id].count > 0).sort((a, b) => facilityName(a).name.localeCompare(facilityName(b).name, 'fr'));
  const cur = (id: string) => api.profile.facilities[id] ?? max[id];
  const custom = Object.keys(api.profile.facilities).length > 0;
  // Ce qu'il reste à payer pour tout amener au maximum du niveau.
  let left = 0;
  let unknown = false;
  for (const id of ids) {
    const c = cur(id), m = max[id];
    for (let l = c.level + 1; l <= m.level; l++) {
      const x = cost(id, l);
      if (x == null) unknown = true;
      else left += x * c.count;
    }
    for (let k = c.count; k < m.count; k++)
      for (let l = 1; l <= m.level; l++) {
        const x = cost(id, l);
        if (x == null) unknown = true;
        else left += x;
      }
  }
  return (
    <details className="card" open={custom}>
      <summary>
        <strong>Mes installations</strong>{' '}
        <span className="muted">{custom ? '(personnalisées)' : '(toutes supposées au maximum du niveau)'}</span>
      </summary>
      <p className="hint">
        Indique ce que tu as vraiment posé et amélioré : le plan et les conseils d'amélioration en tiennent compte. Pour tout amener au maximum
        du niveau {rv} : <b>{nf.format(left)} pièces</b>
        {unknown ? ' (certains coûts inconnus)' : ''}.
      </p>
      <div className="facility-grid">
        {ids.map((id) => {
          const c = cur(id), m = max[id];
          const set = (patch: Partial<typeof c>) => {
            const next = { ...c, ...patch };
            api.setFacility(id, next.count === m.count && next.level === m.level ? null : next);
          };
          return (
            <div key={id} className="facility-row">
              <span>{facilityName(id).name}</span>
              <select value={c.count} onChange={(e) => set({ count: Number(e.target.value) })} aria-label={`Nombre de ${facilityName(id).name}`}>
                {Array.from({ length: m.count + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n} / {m.count}
                  </option>
                ))}
              </select>
              <select value={c.level} onChange={(e) => set({ level: Number(e.target.value) })} aria-label={`Niveau de ${facilityName(id).name}`}>
                {Array.from({ length: m.level }, (_, l) => (
                  <option key={l} value={l + 1}>
                    niv. {l + 1}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {custom && (
        <button type="button" className="link" onClick={() => ids.forEach((id) => api.setFacility(id, null))}>
          Tout remettre au maximum
        </button>
      )}
      <p className="hint">Coûts d'amélioration : données du jeu relevées par Wikily.</p>
    </details>
  );
}

/** Les améliorations à portée, classées par temps gagné pour chaque pièce dépensée. */
export function Upgrades({ options }: { options: PlanOptions }) {
  const [list, setList] = useState<Opportunity[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setList(null), [options]);
  const compute = () => {
    setBusy(true);
    setTimeout(() => {
      setList(opportunities(options));
      setBusy(false);
    }, 20);
  };
  return (
    <section className="card">
      <h2>Quoi améliorer en premier ?</h2>
      <p className="hint">
        Chaque amélioration à ta portée (un niveau de plus, ou une installation de plus) est essayée dans le calcul, puis classée par gain pour
        chaque pièce dépensée.
      </p>
      {!list ? (
        <button type="button" className="btn btn--primary" onClick={compute} disabled={busy}>
          {busy ? 'Calcul…' : '🔧 Classer les améliorations'}
        </button>
      ) : list.length === 0 ? (
        <p className="good">✓ Rien à améliorer : tes installations sont au maximum de ce niveau (ou n'apportent rien de plus à ce plan).</p>
      ) : (
        <ol className="upgrades">
          {list.slice(0, 10).map((o) => (
            <li key={`${o.facility}${o.kind}`}>
              <b>
                {o.kind === 'level'
                  ? `Améliorer ${facilityName(o.facility).name} au niveau ${o.to}`
                  : `${facilityName(o.facility).name} : un exemplaire de plus (${o.to} au total)`}
              </b>
              <span className="muted">{o.cost != null ? `${nf.format(o.cost)} pièces` : 'coût inconnu'}</span>
              <span className="good">{o.unit === 'hours' ? `−${fmtDuration(o.gain)} sur le prochain niveau` : `+${nf.format(o.gain)} pièces/h`}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
