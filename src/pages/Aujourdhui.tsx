import { useMemo, useState } from 'react';
import { ANIIMO_BY_ID } from '../data/aniimo';
import { HOMELAND, itemName } from '../data/homeland';
import codes from '../data/codes.gen.json';
import { idealPool, plan, rosterPool, setupForRv } from '../engine/homeland/optimize';
import { MAX_ANIIMO_BY_RV } from '../engine/rv';
import type { ProfileApi } from '../state/profile';
import { SolverGate } from '../components/SolverGate';
import { fmtDuration } from '../components/format';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Tableau de bord du jour : où j'en suis, ce qu'il reste à faire, les nouveautés. */
export function Aujourdhui({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const rv = profile.rv;
  const target = HOMELAND.levelUp[String(rv + 1)];
  const used = new Set(profile.usedCodes);
  const newCodes = codes.active.filter((c) => !used.has(c.code.toLowerCase()));

  return (
    <div className="page">
      {newCodes.length > 0 && (
        <a className="card card--link" href="#codes">
          <strong>🎁 {newCodes.length} code{newCodes.length > 1 ? 's' : ''} cadeau à utiliser</strong>
          <span className="muted"> — {newCodes.slice(0, 3).map((c) => c.code).join(', ')}
            {newCodes.length > 3 ? '…' : ''}</span>
        </a>
      )}

      {profile.workers.length === 0 && (
        <a className="card card--link" href="#logis">
          <strong>🏡 Commence par saisir ton logis</strong>
          <span className="muted"> — niveau du Camping-car et Aniimo au travail, pour des calculs à ta mesure.</span>
        </a>
      )}

      {target ? (
        <section className="card">
          <h2>Objectif : Camping-car niv. {rv + 1}</h2>
          <p className="hint">Mets à jour ce que tu as en stock : la barre et le temps restant suivent.</p>
          <ul className="progress-list">
            <Progress label="Pièces" have={profile.coins ?? 0} need={target.coins} onChange={api.setCoins} />
            {Object.entries(target.items).map(([id, n]) => (
              <Progress key={id} label={itemName(id).name} have={profile.stock[id] ?? 0} need={n} onChange={(v) => api.setStock(id, v)} />
            ))}
          </ul>
          <SolverGate>
            <Estimate api={api} />
          </SolverGate>
        </section>
      ) : (
        <section className="card">
          <h2>Camping-car au niveau maximum 🎉</h2>
          <p className="hint">
            Il n'y a plus de niveau à viser : la page <a href="#plan">Optimiser</a> calcule le revenu maximal en pièces.
          </p>
        </section>
      )}

      <Checklist />

      <section className="card">
        <h2>Raccourcis</h2>
        <div className="shortcuts">
          <a href="#plan">📈 Plan de production</a>
          <a href="#recruter">🎯 Prochaine recrue</a>
          <a href="#equipes">⚔️ Équipe contre un boss</a>
          <a href="#aniidex">📖 Chercher un Aniimo</a>
        </div>
      </section>
    </div>
  );
}

function Progress({ label, have, need, onChange }: { label: string; have: number; need: number; onChange: (n: number) => void }) {
  const pct = Math.min(100, (have / Math.max(1, need)) * 100);
  return (
    <li className="progress">
      <div className="progress__head">
        <span>{label}</span>
        <label>
          <input type="number" min={0} inputMode="numeric" value={have} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} /> /{' '}
          {nf.format(need)}
        </label>
      </div>
      <div className="bar">
        <div className={`bar__fill${pct >= 100 ? ' bar__fill--done' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/** Temps de production restant avec les ouvriers du joueur (le calcul de la page Optimiser). */
function Estimate({ api }: { api: ProfileApi }) {
  const { profile } = api;
  const result = useMemo(() => {
    const pool = profile.workers.length
      ? rosterPool(profile.workers.map((w) => ({ homeland: ANIIMO_BY_ID.get(w.aniimoId)!.homeland, personality: w.personality })))
      : idealPool(MAX_ANIIMO_BY_RV[profile.rv] - profile.shinies);
    return plan({
      setup: setupForRv(profile.rv),
      workers: pool,
      goal: { kind: 'levelUp', stock: { coins: profile.coins ?? 0, items: profile.stock } },
      watering: true,
      includeUnverified: false,
    });
  }, [profile.rv, profile.workers, profile.shinies, profile.coins, profile.stock]);
  if (!result.feasible) return <p className="hint">Pas de plan possible avec ces ouvriers : voir la page Optimiser.</p>;
  return (
    <p className="estimate">
      Encore <strong>{fmtDuration(result.hours)}</strong> de production en suivant <a href="#plan">le plan optimisé</a>
      {profile.workers.length ? '' : ' (avec des ouvriers idéaux : saisis les tiens pour un temps réel)'}.
    </p>
  );
}

const DEFAULT_TASKS = [
  'Utiliser les nouveaux codes cadeaux',
  'Récolter et relancer toutes les cultures',
  'Relancer les installations de transformation',
  'Vendre les surplus',
  'Mettre à jour pièces et matériaux ici',
];
const TASKS_KEY = 'aniiguide.jour.v1';

/** Liste du jour, remise à zéro chaque jour ; gardée sur cet appareil seulement. */
function Checklist() {
  const today = new Date().toISOString().slice(0, 10);
  const [state, setState] = useState<{ day: string; done: number[] }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(TASKS_KEY) ?? 'null');
      if (s?.day === today && Array.isArray(s.done)) return s;
    } catch {
      // Stockage indisponible : la liste repart de zéro.
    }
    return { day: today, done: [] };
  });
  const toggle = (i: number) => {
    const next = { day: today, done: state.done.includes(i) ? state.done.filter((x) => x !== i) : [...state.done, i] };
    setState(next);
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
    } catch {
      // Tant pis : la case reste cochée le temps de la visite.
    }
  };
  return (
    <section className="card">
      <h2>
        Routine du jour <span className="muted">({state.done.length}/{DEFAULT_TASKS.length})</span>
      </h2>
      <ul className="checklist">
        {DEFAULT_TASKS.map((t, i) => (
          <li key={t}>
            <label>
              <input type="checkbox" checked={state.done.includes(i)} onChange={() => toggle(i)} /> {t}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
