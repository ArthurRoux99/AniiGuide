import { useState } from 'react';
import raw from '../data/eggheist.gen.json';
import { heistPlan } from '../engine/eggheist';
import type { ProfileApi } from '../state/profile';
import { fmtDuration } from '../components/format';

const EH = raw as typeof raw;
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const SOURCE = new Map(EH.sources.map((s) => [s.id, s]));

function Sources({ ids }: { ids: string[] }) {
  return (
    <small className="muted">
      Sources :{' '}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ', '}
          <a href={SOURCE.get(id)?.url} target="_blank" rel="noreferrer">
            {SOURCE.get(id)?.name ?? id}
          </a>
        </span>
      ))}
    </small>
  );
}

/** Opération Œufs (Egg Heist) : guide, suivi, calculateur, rangs et boutique. */
export function Oeufs({ api }: { api: ProfileApi }) {
  const eh = api.profile.eggHeist;
  const rank = EH.ranks[eh.rank];
  const [priceIdx, setPriceIdx] = useState(0);
  const [perRun, setPerRun] = useState({ coins: 40000, shards: 1 });
  const [success, setSuccess] = useState(80);
  const [loss, setLoss] = useState(30000);
  const [minutes, setMinutes] = useState(10);
  const price = EH.prismanaEgg.prices[priceIdx];
  const res = heistPlan({ price, have: eh, perRun, success: success / 100, lossOnFail: loss, minutes });

  const num = (v: number, set: (n: number) => void, label: string, step = 1000) => (
    <label className="stat">
      <span>{label}</span>
      <input type="number" min={0} step={step} inputMode="numeric" value={v} onChange={(e) => set(Math.max(0, Number(e.target.value)))} />
    </label>
  );

  return (
    <div className="page">
      <section className="card">
        <h2>Opération Œufs</h2>
        <p className="hint">
          Le mode « extraction » : 1 à 3 joueurs débarquent sur les Îles perdues, entrent dans le Sanctuaire perdu, déterrent un œuf d'Aniimo et le
          ramènent au bateau. Accessible au niveau {EH.unlock.level} et au rang de Pathfinder {EH.unlock.pathfinderRank}. {EH.team.note}
        </p>
        <ul className="plain">
          <li>
            <b>Pour sortir</b> : {EH.escape}
          </li>
          <li>
            <b>Attention</b> : {EH.faint}
          </li>
          <li>
            <b>Durée</b> : {EH.duration.minutes} min <span className="muted">({EH.duration.conflict})</span>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Mon suivi</h2>
        <div className="form-grid">
          <label className="stat">
            <span>Rang Egg Heist</span>
            <select value={eh.rank} onChange={(e) => api.setEggHeist({ rank: Number(e.target.value) })}>
              {EH.ranks.map((r, i) => (
                <option key={r.name} value={i}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {num(eh.coins, (n) => api.setEggHeist({ coins: n }), 'Pièces de coquille')}
          {num(eh.shards, (n) => api.setEggHeist({ shards: n }), 'Éclats de coquille prismana', 1)}
        </div>
        <p className="hint">
          Score d'une partie à ton rang : paliers à {rank.bands.join(' / ')}. {EH.ranks[eh.rank + 1] ? `Prochain rang : ${EH.ranks[eh.rank + 1].name}.` : ''}
        </p>
      </section>

      <section className="card">
        <h2>Objectif : {EH.prismanaEgg.name}</h2>
        <p className="hint">
          {EH.prismanaEgg.hatches}. {EH.prismanaEgg.shardsFrom}
        </p>
        <div className="chips">
          {EH.prismanaEgg.prices.map((p, i) => (
            <button key={p.label} type="button" className={`chip chip--btn${i === priceIdx ? ' is-active' : ''}`} onClick={() => setPriceIdx(i)}>
              {p.label} : {nf.format(p.coins)} pièces + {p.shards} éclats
            </button>
          ))}
        </div>
        <ul className="progress-list">
          <Bar label="Pièces de coquille" have={eh.coins} need={price.coins} />
          <Bar label="Éclats prismana" have={eh.shards} need={price.shards} />
        </ul>
        <h3>Combien de parties ?</h3>
        <p className="hint">Renseigne tes moyennes : le calcul tient compte des échecs, qui coûtent l'équipement porté.</p>
        <div className="form-grid">
          {num(perRun.coins, (n) => setPerRun({ ...perRun, coins: n }), 'Pièces par partie réussie')}
          {num(perRun.shards, (n) => setPerRun({ ...perRun, shards: n }), 'Éclats par partie réussie', 1)}
          <label className="stat">
            <span>Parties réussies : {success} %</span>
            <input type="range" min={0} max={100} value={success} onChange={(e) => setSuccess(Number(e.target.value))} />
          </label>
          {num(loss, setLoss, 'Équipement perdu si échec (pièces)')}
          {num(minutes, setMinutes, 'Durée d’une partie (min)', 1)}
        </div>
        {res.runs === null ? (
          <p className="bad">
            En moyenne une partie fait perdre des pièces ({nf.format(res.netCoins)}) : baisse la difficulté ou l'équipement emporté, ou fais des
            sorties plus courtes.
          </p>
        ) : res.runs === 0 ? (
          <p className="good">✓ Tu as déjà de quoi l'acheter.</p>
        ) : (
          <p className="estimate">
            Encore <strong>{res.runs} parties</strong> (≈ {fmtDuration(res.hours)} de jeu), limité par les{' '}
            {res.limit === 'shards' ? 'éclats prismana' : 'pièces de coquille'}. Gain moyen par partie : {nf.format(res.netCoins)} pièces,{' '}
            {res.netShards.toFixed(1).replace('.', ',')} éclats.
          </p>
        )}
        <Sources ids={EH.prismanaEgg.sources} />
      </section>

      <section className="card">
        <h2>Équipe</h2>
        <p className="hint">
          Dans le mode, les attributs des Aniimo sont égalisés : comptent leurs compétences, leur rôle et la variété des éléments (les piliers du
          Sanctuaire ne s'ouvrent qu'à leur élément).
        </p>
        <a className="btn btn--primary" href="#equipes/oeufs">
          ⚔️ Composer mon équipe Opération Œufs
        </a>
      </section>

      <section className="card">
        <h2>Difficultés</h2>
        <div className="table-scroll">
          <table className="roadmap">
            <thead>
              <tr>
                <th>Difficulté</th>
                <th>Rang requis</th>
                <th>Équipement</th>
                <th>Pièces pour sortir</th>
                <th>Récompenses possibles</th>
              </tr>
            </thead>
            <tbody>
              {EH.difficulties.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.name}</b>
                    {'ticket' in d && d.ticket && <div className="muted">{d.ticket}</div>}
                  </td>
                  <td>{d.rank ?? 'aucun'}</td>
                  <td>{d.gear}</td>
                  <td className="num">{nf.format(d.escapeCoins)}</td>
                  <td>{d.rewards.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Sources ids={['aniimoverse', 'aniimotools']} />
      </section>

      <section className="card">
        <h2>Rangs</h2>
        <div className="table-scroll">
          <table className="roadmap">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Débloque</th>
                <th>Paliers de score</th>
                <th>Récompenses de passage</th>
              </tr>
            </thead>
            <tbody>
              {EH.ranks.map((r, i) => (
                <tr key={r.name} className={i === eh.rank ? 'is-current' : undefined}>
                  <td>
                    <b>{r.name}</b>
                  </td>
                  <td>{r.unlocks ?? '—'}</td>
                  <td>{r.bands.join(' / ')}</td>
                  <td>{r.rewards.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Sources ids={EH.rankSources} />
      </section>

      <section className="card">
        <h2>Boutique</h2>
        <ul className="sales">
          {EH.shop.map((s) => {
            const lockedRank = s.rank ? EH.ranks.findIndex((r) => r.name === s.rank) : 0;
            const locked = lockedRank > eh.rank;
            return (
              <li key={s.item} className={locked ? 'is-off' : undefined}>
                <span>{s.item}</span>
                <span className="muted">{s.rank ? (locked ? `🔒 ${s.rank}` : s.rank) : ''}</span>
                <b>{nf.format(s.coins)}</b>
              </li>
            );
          })}
        </ul>
        <p className="hint">{EH.shopNote}</p>
        <Sources ids={EH.shopSources} />
      </section>

      <section className="card">
        <h2>Conseils</h2>
        <ul className="plain">
          {EH.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <Sources ids={EH.tipSources} />
        <p className="hint">
          {EH.note} Mise à jour : {new Date(EH.updated).toLocaleDateString('fr-FR')}.
        </p>
      </section>
    </div>
  );
}

function Bar({ label, have, need }: { label: string; have: number; need: number }) {
  const pct = Math.min(100, (have / Math.max(1, need)) * 100);
  return (
    <li className="progress">
      <div className="progress__head">
        <span>{label}</span>
        <span className="muted">
          {nf.format(have)} / {nf.format(need)}
        </span>
      </div>
      <div className="bar">
        <div className={`bar__fill${pct >= 100 ? ' bar__fill--done' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
